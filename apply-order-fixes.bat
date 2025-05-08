@echo off
echo ========================================
echo تطبيق إصلاحات سياسات RLS للطلبات
echo ========================================

rem تحميل متغيرات البيئة من ملف .env إذا كان موجوداً
if exist .env (
    echo جاري تحميل متغيرات البيئة من ملف .env...
    for /F "tokens=*" %%A in (.env) do set %%A
)

rem التحقق من المتغيرات المطلوبة
if "%SUPABASE_URL%"=="" (
    set SUPABASE_URL=https://jpwsohttsxsmyhasvudy.supabase.co
    echo تم تعيين عنوان Supabase افتراضياً: %SUPABASE_URL%
)

if "%SUPABASE_SERVICE_KEY%"=="" (
    echo خطأ: لم يتم تعيين مفتاح خدمة Supabase (SUPABASE_SERVICE_KEY)
    echo يرجى تعيينه في ملف .env أو كمتغير بيئة.
    exit /b 1
)

echo.
echo هذا السكريبت سيقوم بتطبيق سياسات RLS الجديدة التي تسمح بحذف الطلبات
echo وتحديثها بشكل صحيح، وستحل المشكلة الحالية المتعلقة بعدم القدرة على
echo حذف الطلبات عند تفعيل RLS.
echo.
echo جاري قراءة ملف SQL الخاص بالإصلاحات...
powershell -Command "$sql = Get-Content -Path 'fix-orders-rls.sql' -Raw; $sql = $sql -replace '`n', ' ' -replace '`r', ''; $json = ConvertTo-Json -InputObject @{query=$sql} -Compress; $json | Out-File -FilePath 'temp_sql_payload.json' -Encoding utf8"

echo.
echo جاري تطبيق إصلاحات SQL لجداول orders و order_items...
curl -X POST "%SUPABASE_URL%/rest/v1/rpc/exec" ^
-H "apikey: %SUPABASE_SERVICE_KEY%" ^
-H "Authorization: Bearer %SUPABASE_SERVICE_KEY%" ^
-H "Content-Type: application/json" ^
-d @temp_sql_payload.json

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo خطأ: فشل تطبيق إصلاحات SQL!
    del temp_sql_payload.json
    exit /b 1
)

del temp_sql_payload.json

echo.
echo ========================================
echo تم تطبيق إصلاحات SQL بنجاح!
echo ========================================
echo.
echo يجب أن تعمل الآن جميع عمليات الطلبات (الحذف، التحديث) بشكل صحيح.
echo قم باختبار التطبيق للتأكد من نجاح التغييرات.
echo.
echo ملاحظة هامة: يجب أن تكون متصلاً بالإنترنت وأن يكون لديك صلاحيات كافية 
echo على قاعدة البيانات لتنفيذ هذه التغييرات.
echo. 