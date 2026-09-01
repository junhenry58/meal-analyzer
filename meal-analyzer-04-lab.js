// get the DOM elements:
const fileInput = document.querySelector("input");
const uploadedImg = document.querySelector("#uploaded-img");
const sendBtn = document.querySelector("button");  //Analyze button

const spinnerWrapper = document.querySelector("#spinner-wrapper");
const mealNameH3 = document.querySelector("#meal-name"); //put H3 to avoid confusion, not a string, a tag
const descriptionP = document.querySelector("#description"); 
const prepP = document.querySelector("#prep");
const calorieCountP = document.querySelector("#calorie-count"); 
const calsPerItemP = document.querySelector("#cals-per-item")
const gramsP = document.querySelector("#grams"); 

// get the micronutirents checkboxes
const vitsCB = document.querySelector('#vitamins-cb');
const minsCB = document.querySelector('#minerals-cb');
// get the vitamins and minerals p tags for output (which occurs only if checkboxes are checked)
const vitsP = document.querySelector('#vitamins');
const minsP = document.querySelector('#minerals');


// have send button call fn to send img data to server
sendBtn.addEventListener("click", sendImageForAnalysis);

// call a function which runs when user browses for file
fileInput.addEventListener("change", displayUploadedImage);

// instantiate vars in global scope (needed by TWO diff functions)
let uploadedFile;
let imageSrc;
let analysisController;

function resetMealResults() {
    mealNameH3.textContent = "Waiting for analysis...";
    descriptionP.textContent = "Waiting for analysis...";
    prepP.textContent = "Waiting for analysis...";
    calorieCountP.textContent = "Waiting for analysis...";
    calsPerItemP.textContent = "Waiting for analysis...";
    gramsP.textContent = "Waiting for analysis...";


}

// define the function that runs when user clicks Choose File
function displayUploadedImage(event) {
    uploadedFile = event.target.files[0];

    if (!uploadedFile) {
        console.log("No file was selected");
        return;
    }

    // Prevent an older request from putting its result into the newly reset UI.
    if (analysisController) {
        analysisController.abort();
        analysisController = undefined;
    }
    spinnerWrapper.style.display = "none";
    resetMealResults();

    if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
    }

    imageSrc = URL.createObjectURL(uploadedFile);
    uploadedImg.src = imageSrc;

    console.log("Image selected:", uploadedFile.name);
}
function sendImageForAnalysis() {
    if(!uploadedFile) {
        console.log("No file uploaded!")
        mealNameH3.textContent = "Please upload an image to analyze";
        return;
    }
    spinnerWrapper.style.display = "block"; //shows spinner

    analysisController = new AbortController();
    const currentController = analysisController;



    // Build fresh form data from the file that is selected right now.
    const formData = new FormData();
    formData.append("meal_image", uploadedFile);


    // sends the formData containing the img data to flask using fetch()
    fetch("https://meal-analyzer-koy3.onrender.com/upload", {
        method: "POST",
        body: formData,
        signal: currentController.signal
    })
    .then(resJson => {
        if (!resJson.ok) {
            throw new Error(`Request failed (${resJson.status})`);
        }
        return resJson.json();
    })
    .then(resObj => {
        if (currentController !== analysisController) return;
        
        spinnerWrapper.style.display = "none"; //hides spinner
        mealNameH3.textContent = resObj.meal_name;     //textContent or innerHTML
        descriptionP.textContent = resObj.meal_description;
        const prepInstructions = resObj.prep_instructions;
        if (typeof prepInstructions === "string" && prepInstructions.trim()) {
            const prepSteps = prepInstructions
                .trim()
                .split(/\s*(?=\d+[.)]\s+)/)
                .filter(Boolean);

            const prepLines = prepSteps.map(step => {
                const line = document.createElement("div");
                line.textContent = step;
                return line;
            });
            prepP.replaceChildren(...prepLines);
        } else {
            prepP.textContent = "Preparation instructions unavailable";
        }
        calorieCountP.textContent = resObj.total_calories;
        const caloriesPerItem = resObj.cals_per_item;
        if (caloriesPerItem && typeof caloriesPerItem === "object") {
            const calorieLines = Object.entries(caloriesPerItem).map(([item, calories]) => {
                const line = document.createElement("div");
                line.textContent = `${item}: ${calories} calories`;
                return line;
            });
            calsPerItemP.replaceChildren(...calorieLines);
        } else {
            calsPerItemP.textContent = "Calories per item unavailable";
        }

        const macronutrients = resObj.macronutrients;
        gramsP.textContent = macronutrients
            ? `Protein: ${macronutrients.protein}g | Fat: ${macronutrients.fat}g | Carbs: ${macronutrients.carbs}g`
            : "Macronutrient information unavailable";
       
        
    })  
    .catch(error => {
        if (error.name === "AbortError") return;
        console.log(error);
        mealNameH3.textContent = `Analysis failed: ${error.message}`;
    }
    )
    .finally(() => {
        if (currentController !== analysisController) return;
        spinnerWrapper.style.display = "none";
        analysisController = undefined;
        // sendBtn.disabled=false; //adding this showed the spinner
    });

}
    

    
