@echo off
set TNS_ADMIN=c:\Users\mouad\Documents\project\backend\wallet
echo TNS_ADMIN set to %TNS_ADMIN%
impdp parfile=import.par > import_local_output.txt 2>&1
