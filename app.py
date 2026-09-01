from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from openai import OpenAI
import json
import base64
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024

# Keep a public demo from making unlimited paid API requests from one address.
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["50 per day"],
    storage_uri="memory://",
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

#define the fn that sends the img data to openai model for analysis
def analyze_meal(base64_img):
    response = client.chat.completions.create(
        model = "gpt-4o-mini",
        response_format={"type":"json_object"},    
        messages = [
            { 
                "role": "system",
                "content": """You are a dietician and chef. A user sends you an image of a meal, and you reply with the restaurant menu-style name, a savory description and total calories. Respond in JSON format, with keys called "meal_name", "meal_description", "prep_instructions", "total_calories", "cals_per_item" and "macronutrients". The value of "macronutrients" is a dictionary with "carbs", "fat" and "protein" keys, the values of which are gram integers. The "cals_per_item" properties in the example are for reference only. Provide the actual key-value pairs, where the key is the food item and the value is the calories as integer. Here is the exact JSON format:
                {   "meal_name": "restaurant menu-style name of meal",
                    "meal_description": "savory description of meal",
                    "prep_instructions": "a string telling step by step how to make the meal",
                    "total_calories": "total calories in meal",
                    "cals_per_item": { 
                        "steak": 450,
                        "broccoli": 70,
                        "baked potato": 240, 
                        "pat butter": 40,
                        "lemon wedge": 10,
                    },
                    "macronutrients": {
                        "carbs": "grams of carbs",
                        "fat": "grams of fat",
                        "protein": "grams of protein"
                } 
                Use numbers-not strings-for calories and macronutrient quantities.
                """
    
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Provide information about this meal in JSON format, per instructions."
                    },
                    {
                        "type": "image_url",
                        "image_url": { 
                            "url": f"data:image/jpeg;base64, {base64_img}"
                        } #close img url
                    } # close content list
                ] #close user prompt dict
            } #close user prompt dict             
        ] # close messages list
    ) # close create() method
    return response.choices[0].message.content


@app.route("/")
def index():
    return render_template("index.html")

@app.route("/upload", methods=["POST"])
@limiter.limit("10 per hour")
def upload():
    try:
        meal_image = request.files.get("meal_image") # parse incoming img blob
        if meal_image is None:
            return jsonify ( { "error": "no image data found"} ), 400 #bad request, missing data

        if not meal_image.mimetype or not meal_image.mimetype.startswith("image/"):
            return jsonify({"error": "Please upload a valid image file"}), 400

        base64_img = base64.b64encode(meal_image.read()).decode("utf-8")
        
    # make temp file for storing the image temporarily
        # temp_file = tempfile.NamedTemporaryFile(delete=False)
        # meal_image.save(temp_file.name)
        # image_path = temp_file.name
      
        #call fn and send it the img data; fn sends img + prompt to openai
        #fn returns the analysis as json which we save as a variable ai_meal_analysis
        ai_meal_json = analyze_meal(base64_img)

        return json.loads(ai_meal_json), 200 #success

    except Exception as e:
        return jsonify( { "error": str(e) }), 500 #internal server error (crashed in flash backend)

@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({"error": "Image is too large. Maximum size is 8 MB."}), 413
    
if __name__ == "__main__":
    app.run(debug=True)
