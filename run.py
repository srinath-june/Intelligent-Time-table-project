import webbrowser
import threading
import time
from app import app

def open_browser():
    time.sleep(1.5)
    webbrowser.open("http://127.0.0.1:5000")

if __name__ == "__main__":
    threading.Thread(target=open_browser, daemon=True).start()
    print("Starting Intelligent Timetable Generator Server at http://127.0.0.1:5000 ...")
    app.run(host="127.0.0.1", port=5000, debug=False)
