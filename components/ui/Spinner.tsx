import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md', 
  color = '#4F46E5' // لون أساسي افتراضي
}) => {
  const getSize = () => {
    switch (size) {
      case 'sm': return 'w-4 h-4';
      case 'lg': return 'w-8 h-8';
      case 'md':
      default: return 'w-6 h-6';
    }
  };

  return (
    <div className="flex justify-center items-center">
      <div 
        className={`${getSize()} animate-spin rounded-full border-t-2 border-b-2 border-primary`} 
        style={{ borderColor: `${color} transparent ${color} transparent` }}
      />
    </div>
  );
};

export default Spinner; 