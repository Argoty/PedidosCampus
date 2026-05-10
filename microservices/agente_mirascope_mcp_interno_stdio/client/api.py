import asyncio
from flask import Flask, request, jsonify
from flask_cors import CORS
from agent import process_chat

app = Flask(__name__)
CORS(app)

@app.route('/chat', methods=['POST'])
def chat_endpoint():
    data = request.json
    query = data.get('query')
    history = data.get('history', [])
    
    if not query:
        return jsonify({"error": "No query provided"}), 400
        
    try:
        # We run the async process_chat inside the synchronous Flask route
        response_text, updated_history = asyncio.run(process_chat(query, history))
        
        return jsonify({
            "response": response_text,
            "history": updated_history
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
