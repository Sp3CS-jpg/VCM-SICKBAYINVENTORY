/* =========================================================
   VITALIS HEALTH INTELLIGENCE
   JAVASCRIPT
========================================================= */


/* =========================================================
   PAYMENT ACCOUNT
========================================================= */

/*
    PUT YOUR DESTINATION ACCOUNT NUMBER HERE.

    Example:

    const PAYMENT_ACCOUNT = "1234567890";

    IMPORTANT:
    This front-end demo does NOT actually transfer money.
*/

const PAYMENT_ACCOUNT =
    "ENTER-YOUR-ACCOUNT-NUMBER-HERE";


/* =========================================================
   DATABASE
========================================================= */

let currentUser =
    JSON.parse(
        localStorage.getItem("vitalisUser")
    ) || null;


let healthRecords =
    JSON.parse(
        localStorage.getItem("vitalisRecords")
    ) || [];


/* =========================================================
   CLOCK
========================================================= */

function updateClock(){

    const clock =
        document.getElementById("clock");

    if(!clock){
        return;
    }

    const now =
        new Date();

    clock.textContent =
        now.toLocaleTimeString();

}

setInterval(
    updateClock,
    1000
);


/* =========================================================
   SIGN IN
========================================================= */

function signIn(){

    const name =
        document
        .getElementById("loginName")
        .value
        .trim();


    const dob =
        document
        .getElementById("loginDOB")
        .value;


    if(!name){

        alert(
            "Please enter your full name."
        );

        return;
    }


    if(!dob){

        alert(
            "Please enter your date of birth."
        );

        return;
    }


    currentUser = {

        name:name,

        dob:dob

    };


    localStorage.setItem(
        "vitalisUser",
        JSON.stringify(
            currentUser
        )
    );


    loadDashboard();

}


/* =========================================================
   LOAD DASHBOARD
========================================================= */

function loadDashboard(){

    if(!currentUser){
        return;
    }


    document
        .getElementById("loginPage")
        .style.display = "none";


    document
        .getElementById("dashboard")
        .style.display = "block";


    document
        .getElementById("displayName")
        .textContent =
        currentUser.name;


    document
        .getElementById("displayDOB")
        .textContent =
        "DATE OF BIRTH: " +
        formatDate(
            currentUser.dob
        );


    document
        .getElementById("avatar")
        .textContent =
        currentUser.name
        .charAt(0)
        .toUpperCase();


    renderRecords();

    drawGraph();

    updateClock();

}


/* =========================================================
   LOGOUT
========================================================= */

function logout(){

    document
        .getElementById("dashboard")
        .style.display = "none";


    document
        .getElementById("loginPage")
        .style.display = "flex";

}


/* =========================================================
   NAVIGATION
========================================================= */

function showSection(
    sectionId,
    button
){

    document
        .querySelectorAll(".section")
        .forEach(
            section => {

                section.classList.remove(
                    "active"
                );

            }
        );


    document
        .getElementById(sectionId)
        .classList.add(
            "active"
        );


    document
        .querySelectorAll(".nav-button")
        .forEach(
            btn => {

                btn.classList.remove(
                    "active"
                );

            }
        );


    button.classList.add(
        "active"
    );


    if(
        sectionId === "overview"
    ){

        setTimeout(
            drawGraph,
            100
        );

    }

}


/* =========================================================
   HEALTH CHECK
========================================================= */

function runHealthCheck(){

    const pulse =
        Number(
            document
            .getElementById(
                "inputPulse"
            )
            .value
        );


    const oxygen =
        Number(
            document
            .getElementById(
                "inputOxygen"
            )
            .value
        );


    const temp =
        Number(
            document
            .getElementById(
                "inputTemp"
            )
            .value
        );


    const bp =
        document
        .getElementById(
            "inputBP"
        )
        .value
        .trim();


    const symptoms =
        document
        .getElementById(
            "inputSymptoms"
        )
        .value
        .trim();


    if(
        !pulse ||
        !oxygen ||
        !temp ||
        !bp
    ){

        alert(
            "Please enter all vital measurements."
        );

        return;

    }


    const analysis =
        analyzeVitals(
            pulse,
            oxygen,
            temp,
            bp
        );


    /* =========================
       UPDATE VITAL CARDS
    ========================= */

    document
        .getElementById(
            "pulseValue"
        )
        .textContent =
        pulse;


    document
        .getElementById(
            "bpValue"
        )
        .textContent =
        bp;


    document
        .getElementById(
            "oxygenValue"
        )
        .textContent =
        oxygen;


    document
        .getElementById(
            "tempValue"
        )
        .textContent =
        temp.toFixed(1);


    /* =========================
       LCD
    ========================= */

    document
        .getElementById(
            "lcdStatus"
        )
        .textContent =
        analysis.status;


    document
        .getElementById(
            "lcdDescription"
        )
        .textContent =
        analysis.description;


    /* =========================
       HEALTH AI
    ========================= */

    document
        .getElementById(
            "cardioAnalysis"
        )
        .textContent =
        analysis.cardio;


    document
        .getElementById(
            "oxygenAnalysis"
        )
        .textContent =
        analysis.oxygen;


    document
        .getElementById(
            "tempAnalysis"
        )
        .textContent =
        analysis.temperature;


    document
        .getElementById(
            "healthScore"
        )
        .textContent =
        analysis.score;


    /* =========================
       MEAL PLAN
    ========================= */

    generateMealPlan(
        analysis,
        symptoms
    );


    /* =========================
       DATABASE RECORD
    ========================= */

    const record = {

        date:
            new Date().toISOString(),

        pulse:pulse,

        bp:bp,

        oxygen:oxygen,

        temp:temp,

        status:
            analysis.status,

        score:
            analysis.score

    };


    healthRecords.push(
        record
    );


    /*
        Browser storage has limits,
        so this prototype keeps
        the most recent 1,000 records.
    */

    if(
        healthRecords.length > 1000
    ){

        healthRecords =
            healthRecords.slice(
                -1000
            );

    }


    localStorage.setItem(
        "vitalisRecords",
        JSON.stringify(
            healthRecords
        )
    );


    renderRecords();

    drawGraph();


    alert(
        "Health screening completed."
    );

}


/* =========================================================
   HEALTH ANALYSIS
========================================================= */

function analyzeVitals(
    pulse,
    oxygen,
    temp,
    bp
){

    let points = 100;


    let systolic = 0;

    let diastolic = 0;


    const bpParts =
        bp.split("/");


    if(
        bpParts.length === 2
    ){

        systolic =
            Number(
                bpParts[0]
            );


        diastolic =
            Number(
                bpParts[1]
            );

    }


    /* PULSE */

    if(
        pulse < 50 ||
        pulse > 120
    ){

        points -= 25;

    }
    else if(
        pulse < 60 ||
        pulse > 100
    ){

        points -= 10;

    }


    /* OXYGEN */

    if(
        oxygen < 90
    ){

        points -= 35;

    }
    else if(
        oxygen < 95
    ){

        points -= 20;

    }


    /* TEMPERATURE */

    if(
        temp >= 39 ||
        temp < 35
    ){

        points -= 25;

    }
    else if(
        temp >= 38
    ){

        points -= 15;

    }


    /* BLOOD PRESSURE */

    if(
        systolic >= 180 ||
        diastolic >= 120
    ){

        points -= 35;

    }
    else if(
        systolic >= 140 ||
        diastolic >= 90
    ){

        points -= 20;

    }
    else if(
        systolic >= 130 ||
        diastolic >= 80
    ){

        points -= 10;

    }


    points =
        Math.max(
            0,
            Math.min(
                100,
                points
            )
        );


    let status =
        "STABLE";


    let description =
        "The entered measurements did not trigger the prototype's alert thresholds.";


    if(
        points < 70
    ){

        status =
            "ATTENTION";


        description =
            "One or more entered measurements are outside the prototype's preferred screening range.";

    }


    if(
        points < 45
    ){

        status =
            "URGENT";


        description =
            "One or more entered measurements crossed the prototype's urgent screening threshold. Seek appropriate professional medical assessment.";

    }


    return {

        score:points,

        status:status,

        description:description,

        cardio:
            systolic &&
            diastolic

            ?

            "Blood pressure entered as " +
            systolic +
            "/" +
            diastolic +
            "."

            :

            "Blood pressure format could not be analyzed.",


        oxygen:
            oxygen >= 95

            ?

            "Entered oxygen value is within the prototype's preferred range."

            :

            "Entered oxygen value is below the prototype's preferred range.",


        temperature:
            temp >= 36 &&
            temp < 38

            ?

            "Entered temperature is within the prototype's general screening range."

            :

            "Entered temperature is outside the prototype's general screening range."

    };

}


/* =========================================================
   MEAL PLAN
========================================================= */

function generateMealPlan(
    analysis,
    symptoms
){

    const grid =
        document.getElementById(
            "mealGrid"
        );


    const intro =
        document.getElementById(
            "mealIntro"
        );


    let advice =
        "A balanced meal pattern with vegetables, whole grains, protein and adequate water is a general healthy starting point.";


    if(
        analysis.score < 70
    ){

        advice =
            "Because the screening values need attention, these are general food suggestions only. A qualified healthcare professional or dietitian should provide nutrition advice for a specific health condition.";

    }


    intro.textContent =
        advice;


    grid.innerHTML = `

        <div class="meal">

            <div class="meal-time">
                07:00 — BREAKFAST
            </div>

            <h4>
                Balanced Breakfast
            </h4>

            <p>
                Oats or whole grains,
                fruit, a protein source
                and water.
            </p>

        </div>


        <div class="meal">

            <div class="meal-time">
                10:30 — SNACK
            </div>

            <h4>
                Healthy Snack
            </h4>

            <p>
                Fruit, yoghurt or
                another balanced snack.
            </p>

        </div>


        <div class="meal">

            <div class="meal-time">
                13:00 — LUNCH
            </div>

            <h4>
                Balanced Plate
            </h4>

            <p>
                Vegetables, whole-grain
                carbohydrates and protein.
            </p>

        </div>


        <div class="meal">

            <div class="meal-time">
                16:30 — SNACK
            </div>

            <h4>
                Afternoon Fuel
            </h4>

            <p>
                Fruit, nuts where appropriate,
                or yoghurt and water.
            </p>

        </div>


        <div class="meal">

            <div class="meal-time">
                19:00 — DINNER
            </div>

            <h4>
                Light Balanced Dinner
            </h4>

            <p>
                Vegetables, protein and
                a moderate carbohydrate portion.
            </p>

        </div>


        <div class="meal">

            <div class="meal-time">
                THROUGHOUT DAY
            </div>

            <h4>
                Hydration
            </h4>

            <p>
                Drink water regularly according
                to your normal needs and environment.
            </p>

        </div>

    `;

}


/* =========================================================
   RECORD TABLE
========================================================= */

function renderRecords(){

    const table =
        document.getElementById(
            "recordTable"
        );


    const count =
        document.getElementById(
            "recordCount"
        );


    table.innerHTML = "";


    count.textContent =
        healthRecords.length +
        " RECORDS";


    if(
        healthRecords.length === 0
    ){

        table.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    style="
                    text-align:center;
                    color:#526b76;
                    padding:30px;"
                >

                    No health records yet.

                </td>

            </tr>

        `;

        return;

    }


    const recent =
        [...healthRecords]
        .reverse()
        .slice(
            0,
            100
        );


    recent.forEach(
        record => {

            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${formatDateTime(
                        record.date
                    )}
                </td>

                <td>
                    ${record.pulse} BPM
                </td>

                <td>
                    ${escapeHTML(
                        record.bp
                    )}
                </td>

                <td>
                    ${record.oxygen}%
                </td>

                <td>
                    ${record.temp}°C
                </td>

                <td>
                    ${escapeHTML(
                        record.status
                    )}
                </td>

            `;


            table.appendChild(
                row
            );

        }
    );

}


/* =========================================================
   GRAPH
========================================================= */

function drawGraph(){

    const canvas =
        document.getElementById(
            "healthGraph"
        );


    if(!canvas){
        return;
    }


    const ctx =
        canvas.getContext(
            "2d"
        );


    const width =
        canvas.clientWidth;


    const height =
        canvas.clientHeight;


    const dpr =
        window.devicePixelRatio || 1;


    canvas.width =
        width * dpr;


    canvas.height =
        height * dpr;


    ctx.scale(
        dpr,
        dpr
    );


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    /* GRID */

    ctx.strokeStyle =
        "rgba(120,200,220,.08)";

    ctx.lineWidth = 1;


    for(
        let y = 30;
        y < height - 30;
        y += 45
    ){

        ctx.beginPath();

        ctx.moveTo(
            45,
            y
        );

        ctx.lineTo(
            width - 20,
            y
        );

        ctx.stroke();

    }


    /* DATA */

    let records =
        [...healthRecords]
        .slice(-7);


    let values;


    if(
        records.length
    ){

        values =
            records.map(
                r =>
                Number(
                    r.score
                )
            );

    }
    else{

        values =
            [
                72,
                76,
                80,
                77,
                84,
                82,
                88
            ];

    }


    const max = 100;

    const min = 0;


    const graphWidth =
        width - 70;


    const graphHeight =
        height - 65;


    const step =
        graphWidth /
        Math.max(
            values.length - 1,
            1
        );


    /* AREA */

    ctx.beginPath();


    values.forEach(
        (
            value,
            index
        ) => {

            const x =
                45 +
                index * step;


            const y =
                25 +
                (
                    (max - value) /
                    (max - min)
                ) *
                graphHeight;


            if(
                index === 0
            ){

                ctx.moveTo(
                    x,
                    y
                );

            }
            else{

                ctx.lineTo(
                    x,
                    y
                );

            }

        }
    );


    ctx.lineTo(
        45 +
        (
            values.length - 1
        ) *
        step,

        height - 30
    );


    ctx.lineTo(
        45,
        height - 30
    );


    ctx.closePath();


    ctx.fillStyle =
        "rgba(0,220,180,.07)";

    ctx.fill();


    /* LINE */

    ctx.beginPath();


    values.forEach(
        (
            value,
            index
        ) => {

            const x =
                45 +
                index * step;


            const y =
                25 +
                (
                    (max - value) /
                    (max - min)
                ) *
                graphHeight;


            if(
                index === 0
            ){

                ctx.moveTo(
                    x,
                    y
                );

            }
            else{

                ctx.lineTo(
                    x,
                    y
                );

            }

        }
    );


    ctx.strokeStyle =
        "#45ffb3";

    ctx.lineWidth = 3;

    ctx.stroke();


    /* POINTS */

    values.forEach(
        (
            value,
            index
        ) => {

            const x =
                45 +
                index * step;


            const y =
                25 +
                (
                    (max - value) /
                    (max - min)
                ) *
                graphHeight;


            ctx.beginPath();


            ctx.arc(
                x,
                y,
                5,
                0,
                Math.PI * 2
            );


            ctx.fillStyle =
                "#00d9ff";


            ctx.fill();

        }
    );


    /* LABELS */

    ctx.fillStyle =
        "#6e8994";


    ctx.font =
        "10px Arial";


    values.forEach(
        (
            value,
            index
        ) => {

            const x =
                45 +
                index * step;


            ctx.fillText(
                index ===
                values.length - 1

                ?

                "TODAY"

                :

                "DAY " +
                (index + 1),

                x - 12,

                height - 8
            );

        }
    );

}


/* =========================================================
   PAYMENT
========================================================= */

function openPayment(){

    document
        .getElementById(
            "paymentModal"
        )
        .style.display =
        "flex";


    document
        .getElementById(
            "paymentAccount"
        )
        .textContent =
        PAYMENT_ACCOUNT;

}


function closePayment(){

    document
        .getElementById(
            "paymentModal"
        )
        .style.display =
        "none";

}


function simulatePayment(){

    const amount =
        Number(
            document
            .getElementById(
                "paymentAmount"
            )
            .value
        );


    const status =
        document
        .getElementById(
            "paymentStatus"
        );


    if(
        !amount ||
        amount <= 0
    ){

        status.style.display =
            "block";


        status.style.color =
            "var(--yellow)";


        status.style.background =
            "rgba(255,212,92,.08)";


        status.textContent =
            "Enter a valid amount.";


        return;

    }


    /*
        DEMO ONLY.
        No real financial transaction occurs.
    */

    status.style.display =
        "block";


    status.style.color =
        "var(--green)";


    status.style.background =
        "rgba(69,255,179,.08)";


    status.textContent =
        "DEMO PAYMENT VERIFIED — NO REAL MONEY WAS TRANSFERRED.";

}


/* =========================================================
   UTILITIES
========================================================= */

function formatDate(date){

    return new Date(
        date
    ).toLocaleDateString(
        undefined,
        {
            year:"numeric",
            month:"long",
            day:"numeric"
        }
    );

}


function formatDateTime(date){

    return new Date(
        date
    ).toLocaleString();

}


function escapeHTML(text){

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text;

    return div.innerHTML;

}


/* =========================================================
   RESIZE GRAPH
========================================================= */

window.addEventListener(
    "resize",
    drawGraph
);


/* =========================================================
   RESTORE USER
========================================================= */

if(currentUser){

    loadDashboard();

}