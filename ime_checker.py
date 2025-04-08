import ctypes
import win32pipe
import win32file
import win32con
import win32gui
import time
from ctypes import wintypes
import win32api

# Windows constants and API calls setup
user32 = ctypes.WinDLL('user32')
imm32 = ctypes.WinDLL('imm32')

# 设置GetKeyState返回类型
user32.GetKeyState.restype = wintypes.SHORT

# IME 控制命令
IME_GETOPENSTATUS = 0x0005
IME_GETCONVERSIONMODE = 0x0001
IME_SETCONVERSIONMODE = 0x0002

class IME:
    @staticmethod
    def get_focused_window():
        hwnd = win32gui.GetForegroundWindow()
        thread_id = user32.GetWindowThreadProcessId(hwnd, None)
        return hwnd

    @staticmethod
    def get_open_status(hwnd=None):
        hwnd = hwnd or IME.get_focused_window()
        ime_hwnd = imm32.ImmGetDefaultIMEWnd(hwnd)
        
        status = wintypes.LPARAM()
        user32.SendMessageTimeoutW(
            ime_hwnd,
            0x0283,  # WM_IME_CONTROL
            IME_GETOPENSTATUS,
            0,
            win32con.SMTO_ABORTIFHUNG,
            1000,
            ctypes.byref(status)
        )
        return status.value

    @staticmethod
    def get_conversion_mode(hwnd=None):
        hwnd = hwnd or IME.get_focused_window()
        ime_hwnd = imm32.ImmGetDefaultIMEWnd(hwnd)
        
        mode = wintypes.LPARAM()
        user32.SendMessageTimeoutW(
            ime_hwnd,
            0x0283,  # WM_IME_CONTROL
            IME_GETCONVERSIONMODE,
            0,
            win32con.SMTO_ABORTIFHUNG,
            1000,
            ctypes.byref(mode)
        )
        return mode.value

    @staticmethod
    def get_input_mode(hwnd=None):
        hwnd = hwnd or IME.get_focused_window()
        status = IME.get_open_status(hwnd)
        
        if not status:
            return 0
        
        conversion_mode = IME.get_conversion_mode(hwnd)
        return conversion_mode & 1  # 取最后一位判断中英文

    @staticmethod
    def is_caps_lock_on():
        state = user32.GetKeyState(win32con.VK_CAPITAL)
        return (state & 0x0001) != 0


def send_data(pipe):
    while True:
        input_mode = IME.get_input_mode()
        caps_lock_on = IME.is_caps_lock_on()
        
        # Prepare the message to send
        response = f"{input_mode},{caps_lock_on}\n"
        
        # Send the data over the pipe to JS
        try:
            win32file.WriteFile(pipe, response.encode())
        except Exception as e:
            print(f"Error sending data: {e}")
            break
        
        # Wait for 100ms before sending the next update
        time.sleep(0.1)

def main():
    pipe_name = r"\\.\pipe\ime_pipe"

    # Create the named pipe using pywin32
    try:
        pipe = win32pipe.CreateNamedPipe(
            pipe_name,
            win32pipe.PIPE_ACCESS_DUPLEX,
            win32pipe.PIPE_TYPE_MESSAGE | win32pipe.PIPE_READMODE_MESSAGE | win32pipe.PIPE_WAIT,
            1,  # Only one client at a time
            512,  # Output buffer size
            512,  # Input buffer size
            0,  # Default timeout
            None
        )
        print("Pipe created, waiting for a connection...")
        
        # Wait for the client (JS) to connect
        win32pipe.ConnectNamedPipe(pipe, None)
        print("Client connected.")
        
        # Start sending data periodically
        send_data(pipe)
    except Exception as e:
        print(f"Error while creating pipe: {e}")

if __name__ == "__main__":
    main()
