import http.server, sys, os, json, base64, urllib.parse
ROOT=sys.argv[1]; OUT=sys.argv[2]; os.makedirs(OUT, exist_ok=True)
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s,*a,**k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s,*a): pass
    def do_POST(s):
        n=int(s.headers['Content-Length']); body=json.loads(s.rfile.read(n))
        if 'img' in body:
            open(os.path.join(OUT, body['name']),'wb').write(base64.b64decode(body['img'].split(',')[1]))
        else:
            open(os.path.join(OUT, body['name']),'w').write(json.dumps(body))
        s.send_response(200); s.end_headers()
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[3])), H).serve_forever()
