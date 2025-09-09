import { supabase } from './supabase-client';

// Centralized real-time subscription manager to prevent memory leaks and overlapping subscriptions
class RealtimeManager {
  private static instance: RealtimeManager;
  private channel: any = null;
  private subscribers: Map<string, Set<(payload: any) => void>> = new Map();
  private isConnected = false;

  private constructor() {}

  public static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  // Subscribe to product changes
  public subscribe(componentId: string, callback: (payload: any) => void): void {
    // Add callback to subscribers
    if (!this.subscribers.has(componentId)) {
      this.subscribers.set(componentId, new Set());
    }
    this.subscribers.get(componentId)!.add(callback);

    // Initialize channel if it doesn't exist
    if (!this.channel) {
      this.initializeChannel();
    }
  }

  // Unsubscribe component
  public unsubscribe(componentId: string): void {
    this.subscribers.delete(componentId);
    
    // If no subscribers left, disconnect
    if (this.subscribers.size === 0) {
      this.disconnect();
    }
  }

  // Initialize the global channel
  private initializeChannel(): void {
    if (this.channel) return;

    this.channel = supabase.channel('products-changes');

    // Set up product table listeners
    this.channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'products'
        },
        (payload: any) => this.broadcastToSubscribers('INSERT', payload)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products'
        },
        (payload: any) => this.broadcastToSubscribers('UPDATE', payload)
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'products'
        },
        (payload: any) => this.broadcastToSubscribers('DELETE', payload)
      )
      .subscribe((status: string) => {
        this.isConnected = status === 'SUBSCRIBED';
      });
  }

  // Broadcast changes to all subscribers
  private broadcastToSubscribers(event: string, payload: any): void {
    this.subscribers.forEach((callbacks) => {
      callbacks.forEach((callback) => {
        try {
          callback({ event, ...payload });
        } catch (error) {
          console.error('Error in realtime callback:', error);
        }
      });
    });
  }

  // Disconnect and cleanup
  private disconnect(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
      this.isConnected = false;
    }
  }

  // Get connection status
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export default RealtimeManager;