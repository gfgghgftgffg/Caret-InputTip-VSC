from soeasypack import to_pack

save_dir = r'C:\\Users\\莫林\Desktop\\'
main_py_path = r"C:\\Users\\莫林\Desktop\\inputTip\\caret-inputtip\\ime_checker.py"
exe_name = 'ime_checjer.exe'
to_pack(main_py_path, save_dir, embed_exe=False,exe_name=exe_name, onefile=True,hide_cmd=False)