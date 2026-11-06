#!/bin/sh
# Local hub for Overview and Signal. No account, no upload: it serves files from this machine only.
# Usage: ./serve.sh            (then open http://localhost:4173/overview/)
#        PORT=5000 ./serve.sh
port="${PORT:-4173}"
root="$(cd "$(dirname "$0")/.." && pwd)"   # ~/Desktop/@john, so ../signal is reachable
url="http://localhost:$port/overview/"
echo "Overview hub: $url  (Ctrl+C to stop)"
( sleep 1; command -v open >/dev/null && open "$url" || xdg-open "$url" >/dev/null 2>&1 ) &
# no-store: the browser always loads the latest files, so a reload never shows an old prototype
cd "$root" && exec python3 -I -c '
import http.server, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
' "$port"
