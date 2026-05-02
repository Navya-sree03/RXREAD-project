import os
import base64
import json
import re
from flask import Flask, render_template, request, jsonify
import anthropic

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB max upload

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_media_type(filename):
    ext = filename.rsplit('.', 1)[1].lower()
    mapping = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}
    return mapping.get(ext, 'image/jpeg')

SYSTEM_PROMPT = """You are a medical prescription reader assistant. The user will upload an image of a handwritten or printed doctor's prescription.

Your job is to carefully extract all medicine-related information and return it as a JSON object with this exact shape:
{
  "doctor": "Doctor name if visible, else null",
  "patient": "Patient name if visible, else null",
  "date": "Date if visible, else null",
  "hospital": "Hospital or clinic name if visible, else null",
  "summary": "A 1-2 sentence plain-English summary of what was prescribed and why if mentioned.",
  "medicines": [
    {
      "name": "Medicine name",
      "dosage": "e.g. 500mg or null",
      "frequency": "e.g. Twice daily or null",
      "duration": "e.g. 5 days or null",
      "instructions": "Any special instructions like after food, with water etc., or null",
      "quantity": "Total quantity if mentioned, else null"
    }
  ],
  "diagnosis": "Diagnosis or reason for prescription if mentioned, else null",
  "notes": "Any other relevant notes from the prescription, or null"
}

Return ONLY valid JSON. No markdown, no explanation, no backticks. If you cannot read a field clearly, set it to null. Do your absolute best to interpret unclear or messy handwriting."""

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyse', methods=['POST'])
def analyse():
    if 'prescription' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['prescription']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Only JPG, PNG, and WEBP images are supported'}), 400

    try:
        image_data = file.read()
        image_b64 = base64.standard_b64encode(image_data).decode('utf-8')
        media_type = get_media_type(file.filename)

        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1500,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64
                            }
                        },
                        {
                            "type": "text",
                            "text": "Please read this prescription and extract all medicine information as JSON."
                        }
                    ]
                }
            ]
        )

        raw = response.content[0].text.strip()
        raw = re.sub(r'```json|```', '', raw).strip()
        result = json.loads(raw)
        return jsonify({'success': True, 'data': result})

    except json.JSONDecodeError:
        return jsonify({'error': 'Could not parse prescription. Please try a clearer image.'}), 422
    except anthropic.APIError as e:
        return jsonify({'error': f'AI service error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Something went wrong: {str(e)}'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
