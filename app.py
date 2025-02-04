from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route('/install', methods=['POST'])
def install_pkg():
    data = request.get_json()
    pkg_file = data.get('pkg_file')

    if not pkg_file:
        return jsonify({"error": "No PKG file provided"}), 400

    try:
        # Send PKG to PS4 IP
        ps4_url = "http://192.168.1.58:12801"  # Your PS4 Remote PKG Installer URL
        files = {'file': (pkg_file, open(pkg_file, 'rb'))}
        response = requests.post(ps4_url, files=files)
        
        if response.status_code == 200:
            return jsonify({"message": "PKG installed successfully!"}), 200
        else:
            return jsonify({"error": "Failed to install PKG"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5000)
