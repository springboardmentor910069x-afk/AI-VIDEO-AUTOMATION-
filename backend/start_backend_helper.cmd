@echo off
REM Helper to start backend using mvnw.cmd with proper quoting and logging
cd /d "C:\Users\HP\Desktop\ClipMind AI\backend"
call mvnw.cmd spring-boot:run > "C:\Users\HP\Desktop\ClipMind AI\backend\backend_run_stdout.log" 2> "C:\Users\HP\Desktop\ClipMind AI\backend\backend_run_stderr.log"
