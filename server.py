from flask import Flask, send_from_directory, Response, request, jsonify
import os
import json
import urllib.request
import urllib.error

app = Flask(__name__, static_folder='.', static_url_path='')

@app.after_request
def add_cors_headers(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-control-Allow-Headers'] = 'Content-Type, Authorization'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return resp

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/ping')
def ping():
    return Response('pong', status=200, content_type='text/plain')

@app.route('/api/generate', methods=['POST', 'OPTIONS'])
def api_generate():
    if request.method == 'OPTIONS':
        return Response(status=204)
    payload = request.get_json(silent=True) or {}
    prompt = payload.get('prompt', '').strip()
    image_size = payload.get('image_size', '1024x1024').strip()
    steps = int(payload.get('num_inference_steps', 20))

    api_url = 'https://api.siliconflow.com/v1/images/generations'
    api_key = os.environ.get('SILICONFLOW_API_KEY')
    if not api_key:
        return jsonify({'error': 'SILICONFLOW_API_KEY not set'}), 500

    body = {
        'model': 'Qwen/Qwen-Image',
        'prompt': prompt,
        'image_size': image_size,
        'num_inference_steps': steps,
    }
    data = json.dumps(body).encode('utf-8')

    try:
        req = urllib.request.Request(api_url, data=data, method='POST')
        req.add_header('Content-Type', 'application/json')
        auth_value = api_key if api_key.lower().startswith('bearer ') else f'Bearer {api_key}'
        req.add_header('Authorization', auth_value)
        with urllib.request.urlopen(req) as r:
            resp_body = r.read()
            content_type = r.headers.get('Content-Type', 'application/json')
        try:
            parsed = json.loads(resp_body.decode('utf-8'))
            return jsonify(parsed), 200
        except Exception:
            return Response(resp_body, status=200, content_type=content_type)
    except urllib.error.HTTPError as e:
        try:
            resp_body = e.read()
            content_type = e.headers.get('Content-Type', 'application/json')
            return Response(resp_body, status=e.code, content_type=content_type)
        except Exception:
            return jsonify({'error': f'HTTP {e.code}'}), e.code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5053)