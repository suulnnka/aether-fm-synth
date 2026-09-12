"""开发/使用用的本地静态服务器(禁用缓存, 保证改动即时生效)
用法: python server.py [端口]  (默认 8765)
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler)
    print(f"Serving http://127.0.0.1:{PORT}/  (Ctrl+C 停止)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.server_close()
