// --- testattempt.js ---

// Ensure this script is included AFTER the specific test data variables are defined in the HTML.
// EXPECTED GLOBAL VARIABLES defined in HTML before this script:
// - testData (Array of question objects, NOW EXPECTED TO HAVE 'chapter' PROPERTY)
// - CURRENT_TEST_NAME (String, e.g., "JEE Main 8 April S2")
// - RESULT_PAGE_URL (String, e.g., "JM8aprilS2result.html")
// - TEST_DURATION_MINUTES (Number, e.g., 180)

document.addEventListener('DOMContentLoaded', () => {
    // --- Validate required global variables ---
    if (typeof testData === 'undefined' || !Array.isArray(testData)) {
        console.error("FATAL: 'testData' array is not defined globally in the HTML before Testattempt.js.");
        alert("Error: Test configuration is missing. Cannot load test.");
        return;
    }
    if (typeof CURRENT_TEST_NAME === 'undefined' || typeof CURRENT_TEST_NAME !== 'string') {
        console.error("FATAL: 'CURRENT_TEST_NAME' string is not defined globally in the HTML before Testattempt.js.");
        alert("Error: Test configuration is missing. Cannot load test.");
        return;
    }
    if (typeof RESULT_PAGE_URL === 'undefined' || typeof RESULT_PAGE_URL !== 'string') {
        console.error("FATAL: 'RESULT_PAGE_URL' string is not defined globally in the HTML before Testattempt.js.");
        alert("Error: Test configuration is missing. Cannot load test.");
        return;
    }
    if (typeof TEST_DURATION_MINUTES === 'undefined' || typeof TEST_DURATION_MINUTES !== 'number') {
        console.warn("'TEST_DURATION_MINUTES' is not defined globally in the HTML. Defaulting to 180 minutes.");
        window.TEST_DURATION_MINUTES = 180; // Set default
    }
    // --- END Validation ---

    // --- State Variables ---
    let currentSection = testData.length > 0 ? testData[0].section : null;
    let currentQuestionIndexInSection = 0; // Index WITHIN the current section
    let currentQuestionGlobalIndex = 0; // Index in the main testData array
    let timeLeft = typeof TEST_DURATION_MINUTES !== 'undefined' ? TEST_DURATION_MINUTES * 60 : 180 * 60;
    let timerInterval = null;
    let testSubmitted = false;
    let questionStartTime = null; // Timestamp when the current question was loaded

    // --- DOM Elements ---
    const sectionNav = document.querySelector('.section-nav');
    const timerEl = document.getElementById('timer');
    const currentSectionNameEl = document.getElementById('current-section-name');
    const paletteSectionNameEl = document.getElementById('palette-section-name');
    const questionNumberEl = document.getElementById('question-number');
    const questionTextEl = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const questionPalette = document.getElementById('question-palette');
    const markReviewBtn = document.getElementById('mark-review-btn');
    const clearResponseBtn = document.getElementById('clear-response-btn');
    const saveNextBtn = document.getElementById('save-next-btn');
    const submitTestBtn = document.getElementById('submit-test-btn');
    const summaryOverlay = document.getElementById('summary-overlay');
    const summaryTableBody = document.querySelector('#summary-table tbody');
    const confirmSubmitBtn = document.getElementById('confirm-submit-btn');
    const cancelSubmitBtn = document.getElementById('cancel-submit-btn');
    const testTitleElement = document.querySelector('.header-left h1');
    // --- END DOM Elements ---

    // --- Marking Scheme ---
    // Default marking scheme (can be overridden by question-specific data if needed later)
    const MARKING_SCHEME = {
        mcq: { correct: 4, incorrect: -1, unattempted: 0 },
        integer: { correct: 4, incorrect: -1, unattempted: 0 }
    };
    // --- END Marking Scheme ---

    // --- MathJax Loading ---
    function loadMathJax() {
        if (typeof MathJax !== 'undefined') {
            // console.log("Testattempt.js: MathJax already loaded or loading.");
            return; // Avoid loading multiple times
        }
        console.log("Testattempt.js: Configuring and loading MathJax...");
        window.MathJax = {
            tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']], processEscapes: true },
            svg: { fontCache: 'global' },
            options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] },
            startup: {
                ready: () => {
                    console.log('Testattempt.js: MathJax is loaded and ready.');
                    MathJax.startup.defaultReady();
                    // Attempt initial typesetting after ready (useful if DOM is ready before MathJax)
                    if (document.readyState === 'complete' || document.readyState === 'interactive') {
                         if (questionTextEl && optionsContainer) {
                             MathJax.typesetPromise([questionTextEl, optionsContainer])
                                .catch((err) => console.error('Initial MathJax typesetting error:', err));
                         }
                    }
                }
            }
        };
        const script = document.createElement('script');
        script.type = 'text/javascript'; script.id = 'MathJax-script';
        script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
        script.async = true; document.head.appendChild(script);
    }
    // --- END MathJax Loading ---

    // --- Core Functions ---

    const sections = [...new Set(testData.map(q => q.section))];

    function getSectionQuestions() {
        if (!currentSection) return [];
        // Return shallow copy to avoid direct modification issues if needed later
        return testData.filter(q => q.section === currentSection);
    }

    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.max(0, Math.floor(seconds % 60)).toString().padStart(2, '0'); // Ensure integer seconds
        return `${h}:${m}:${s}`;
    }

    function updateTimer() {
        if (timerEl) {
            timerEl.textContent = formatTime(timeLeft);
        }
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            if (!testSubmitted) {
                alert("Time's up! The test will be submitted automatically.");
                submitTest();
            }
        } else if (!testSubmitted) {
            timeLeft--;
        }
    }

    function renderSectionTabs() {
        if (!sectionNav) return;
        sectionNav.innerHTML = '';
        sections.forEach(section => {
            const tab = document.createElement('button');
            tab.classList.add('section-tab');
            tab.textContent = section;
            tab.dataset.section = section;
            if (section === currentSection) {
                tab.classList.add('active');
            }
            tab.addEventListener('click', () => switchSection(section));
            sectionNav.appendChild(tab);
        });
    }

    function switchSection(sectionName) {
        if (testSubmitted || sectionName === currentSection) return;

        stopQuestionTimer(); // Record time for the question being left

        currentSection = sectionName;
        const firstGlobalIndexInNewSection = testData.findIndex(q => q.section === sectionName);
        const questionsInNewSection = getSectionQuestions(); // Get questions for the *new* section
        const firstQuestionObject = testData[firstGlobalIndexInNewSection];
        const firstIndexInSection = firstQuestionObject ? questionsInNewSection.findIndex(q => q.id === firstQuestionObject.id) : -1;

        currentQuestionIndexInSection = (firstIndexInSection !== -1) ? firstIndexInSection : 0;
        currentQuestionGlobalIndex = (firstGlobalIndexInNewSection !== -1) ? firstGlobalIndexInNewSection : -1;

        renderSectionTabs();
        renderQuestionPalette(); // Render palette for the new section

        if (currentQuestionGlobalIndex !== -1) {
            loadQuestion(currentQuestionIndexInSection); // Load the first question of the new section
        } else {
            console.error("Could not find first question for section:", sectionName);
            if (questionTextEl) questionTextEl.innerHTML = `Error: Could not load questions for section ${sectionName}.`;
            if (optionsContainer) optionsContainer.innerHTML = "";
            questionStartTime = null; // Ensure timer is stopped if no question loads
        }
    }

    function stopQuestionTimer() {
        if (currentQuestionGlobalIndex !== -1 && currentQuestionGlobalIndex < testData.length && questionStartTime) {
            const durationMillis = Date.now() - questionStartTime;
            const durationSeconds = durationMillis / 1000;

            const currentQ = testData[currentQuestionGlobalIndex];
            if (currentQ) {
                // Ensure timeSpent is a number before adding
                 if (typeof currentQ.timeSpent !== 'number' || isNaN(currentQ.timeSpent)) {
                     currentQ.timeSpent = 0; // Initialize if not a number
                 }
                currentQ.timeSpent += durationSeconds;
                // console.log(`Stopped timer for Q (Global Index: ${currentQuestionGlobalIndex}, ID: ${currentQ.id}). Added ${durationSeconds.toFixed(2)}s. Total: ${currentQ.timeSpent.toFixed(2)}s`);
            } else {
                 console.warn("Could not find question object for global index:", currentQuestionGlobalIndex, "while stopping timer.");
            }
        }
        // Reset start time - it will be set again when the next question loads
        questionStartTime = null;
    }

    function renderQuestionPalette() {
        if (!questionPalette || !paletteSectionNameEl) return;
        questionPalette.innerHTML = '';
        paletteSectionNameEl.textContent = currentSection || 'Palette';
        const questions = getSectionQuestions(); // Questions for the CURRENT section

        if (questions.length === 0 && currentSection) {
             questionPalette.innerHTML = `<p style="padding: 10px; font-size: 0.8em; color: #666;">No questions in this section.</p>`;
             return;
        }

        questions.forEach((q, indexInSection) => {
            const btn = document.createElement('button');
            btn.classList.add('q-btn');
            btn.textContent = indexInSection + 1; // Display 1-based index
            btn.dataset.indexInSection = indexInSection;
            btn.dataset.id = q.id;
            updatePaletteButtonClass(btn, q.status);

            // Check if this button corresponds to the currently loaded question
            if (indexInSection === currentQuestionIndexInSection) {
                 btn.classList.add('active-question');
            }

            btn.addEventListener('click', () => jumpToQuestion(indexInSection));
            questionPalette.appendChild(btn);
        });
    }

    function updatePaletteButtonClass(buttonElement, status) {
        if (!buttonElement) return;
        const isActive = buttonElement.classList.contains('active-question');
        // Reset classes, preserving 'active-question' if it was there
        buttonElement.className = 'q-btn'; // Base class
        if (isActive) buttonElement.classList.add('active-question');

        // Add status class
        switch (status) {
            case 'answered': buttonElement.classList.add('answered'); break;
            case 'marked-review': buttonElement.classList.add('marked-review'); break;
            case 'answered-marked-review': buttonElement.classList.add('answered-marked-review'); break;
            case 'not-answered': buttonElement.classList.add('not-answered'); break;
            case 'not-visited':
            default:
                buttonElement.classList.add('not-visited');
                break;
        }
    }

    function updateQuestionStatus(indexInSection, newStatus) {
        const questions = getSectionQuestions();
        if (indexInSection >= 0 && indexInSection < questions.length) {
            const question = questions[indexInSection]; // This gets the object from the filtered array
            // We need to update the original testData object as well
            const originalQuestion = testData.find(q => q.id === question.id);
            if (originalQuestion) {
                originalQuestion.status = newStatus;
                const btn = questionPalette.querySelector(`.q-btn[data-index-in-section="${indexInSection}"]`);
                if (btn) {
                    updatePaletteButtonClass(btn, newStatus);
                }
            } else {
                console.warn("Could not find original question in testData to update status for ID:", question.id);
            }
        } else {
             console.warn("Invalid indexInSection for status update:", indexInSection);
        }
    }

    function loadQuestion(indexInSection) { // Parameter is index WITHIN the current section
        if (testSubmitted) return;
        const questions = getSectionQuestions();

        if (!questions || questions.length === 0 || indexInSection < 0 || indexInSection >= questions.length) {
            console.error("Attempted to load invalid question index:", indexInSection, "in section:", currentSection);
            // Handle gracefully, e.g., show message or load first if available
            if (questions && questions.length > 0) {
                 console.warn("Falling back to loading index 0.");
                 indexInSection = 0; // Try loading the first question instead
            } else {
                 if (questionTextEl) questionTextEl.innerHTML = `No questions available in section: ${currentSection}.`;
                 if (optionsContainer) optionsContainer.innerHTML = '';
                 questionStartTime = null; // Ensure timer is stopped
                 return; // Cannot proceed
            }
        }

        const questionToLoad = questions[indexInSection];
        const globalIndex = testData.findIndex(q => q.id === questionToLoad.id);

        if (globalIndex === -1) {
            console.error("FATAL: Could not find global index for question with ID:", questionToLoad.id);
            // This indicates a mismatch between getSectionQuestions and testData
             if (questionTextEl) questionTextEl.innerHTML = `Error: Could not locate question data.`;
             if (optionsContainer) optionsContainer.innerHTML = '';
             questionStartTime = null;
             return; // Cannot proceed
        }

        // Stop timer for PREVIOUS question (handled by navigation functions)
        // We only start the timer for the NEW question here

        // Update state variables
        currentQuestionIndexInSection = indexInSection;
        currentQuestionGlobalIndex = globalIndex;
        const question = testData[currentQuestionGlobalIndex]; // Use the canonical object from testData

        if (!question) {
             console.error("FATAL: Question object not found at global index", currentQuestionGlobalIndex);
             // This shouldn't happen if findIndex succeeded
             return;
        }

        // Update status if first visit
        if (question.status === 'not-visited') {
            // Update status in the data and visually on the palette button
            updateQuestionStatus(indexInSection, 'not-answered');
        } else {
             // Ensure palette is synced even if not first visit (e.g., after refresh or section switch)
             const btn = questionPalette.querySelector(`.q-btn[data-index-in-section="${indexInSection}"]`);
             if(btn) updatePaletteButtonClass(btn, question.status);
        }


        // Update UI Elements
        if (currentSectionNameEl) currentSectionNameEl.textContent = currentSection;
        if (questionNumberEl) questionNumberEl.textContent = `Question No. ${indexInSection + 1}`;
        if (questionTextEl) questionTextEl.innerHTML = question.questionText || '[Question text is missing]';

        // Update Palette Highlighting
        if (questionPalette) {
            questionPalette.querySelectorAll('.q-btn.active-question').forEach(btn => btn.classList.remove('active-question'));
            const currentPaletteBtn = questionPalette.querySelector(`.q-btn[data-index-in-section="${indexInSection}"]`);
            if (currentPaletteBtn) {
                currentPaletteBtn.classList.add('active-question');
            }
        }

        // Render Options/Input
        if (optionsContainer) {
            optionsContainer.innerHTML = ''; // Clear previous options
            if (question.type === 'mcq' && Array.isArray(question.options)) {
                question.options.forEach((option, i) => {
                    const optionId = `q${question.id}_opt${i}`;
                    const div = document.createElement('div');
                    div.classList.add('option');
                    // Check userAnswer strictly against the index 'i'
                    const isChecked = question.userAnswer === i;
                    div.innerHTML = `
                        <label for="${optionId}">
                            <input type="radio" id="${optionId}" name="q${question.id}_options" value="${i}" ${isChecked ? 'checked' : ''}>
                            <span>${option || '[Option text missing]'}</span>
                        </label>`;
                    optionsContainer.appendChild(div);
                });
            } else if (question.type === 'integer') {
                const inputId = `q${question.id}_input`;
                const input = document.createElement('input');
                input.setAttribute('type', 'text'); // Use text to allow potential negative/decimal inputs if needed
                input.setAttribute('id', inputId);
                input.setAttribute('inputmode', 'numeric'); // Hint for mobile keyboards
                input.classList.add('integer-input');
                input.placeholder = "Enter your answer";
                input.value = (question.userAnswer !== null && question.userAnswer !== undefined) ? question.userAnswer : '';
                optionsContainer.appendChild(input);
            } else {
                 optionsContainer.innerHTML = '<p>Unsupported question type or options missing.</p>';
            }
        }

        // Trigger MathJax Typesetting
        if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
            const elementsToTypeset = [questionTextEl, optionsContainer].filter(el => el !== null);
            if (elementsToTypeset.length > 0) {
                MathJax.typesetPromise(elementsToTypeset)
                   .catch((err) => console.error('MathJax typesetting error:', err));
            }
        } else if (typeof MathJax === 'undefined') {
            console.warn(`MathJax not available. Typesetting skipped for question ID: ${question.id}`);
        }

        // Start timer for the newly loaded question
        questionStartTime = Date.now();
        // console.log(`Started timer for Q (Global Index: ${currentQuestionGlobalIndex}, ID: ${question.id}) at ${questionStartTime}`);
    }

    function getSelectedAnswer() {
        const question = testData[currentQuestionGlobalIndex]; // Use the global index to get the correct question object
        if (!question || !optionsContainer) return null;

        if (question.type === 'mcq') {
            const selectedRadio = optionsContainer.querySelector(`input[name="q${question.id}_options"]:checked`);
            // Return the integer index or null
            return selectedRadio ? parseInt(selectedRadio.value, 10) : null;
        } else if (question.type === 'integer') {
            const input = optionsContainer.querySelector('.integer-input');
            // Return the trimmed string value or null if empty
            return input && input.value.trim() !== '' ? input.value.trim() : null;
        }
        return null;
    }

    // --- Button Action Handlers ---

    function saveAndNext() {
        if (testSubmitted) return;
        if (currentQuestionGlobalIndex === -1) return; // No question loaded

        stopQuestionTimer(); // Stop timer for the current question

        const question = testData[currentQuestionGlobalIndex];
        const selectedAnswer = getSelectedAnswer();
        question.userAnswer = selectedAnswer; // Update the answer in the main testData object

        // Determine new status based on whether an answer was selected and previous state
        let newStatus = 'not-answered'; // Default if no answer
        if (selectedAnswer !== null) {
            // Answered: status is either 'answered' or 'answered-marked-review'
            newStatus = (question.status === 'marked-review' || question.status === 'answered-marked-review')
                         ? 'answered-marked-review'
                         : 'answered';
        } else {
             // Not answered: status is either 'not-answered' or 'marked-review'
             newStatus = (question.status === 'marked-review' || question.status === 'answered-marked-review')
                          ? 'marked-review'
                          : 'not-answered';
        }

        updateQuestionStatus(currentQuestionIndexInSection, newStatus); // Update status in data and palette
        moveToNextQuestion(); // Load the next question (will start its timer)
    }

    function markForReviewAndNext() {
        if (testSubmitted) return;
        if (currentQuestionGlobalIndex === -1) return;

        stopQuestionTimer(); // Stop timer for the current question

        const question = testData[currentQuestionGlobalIndex];
        const selectedAnswer = getSelectedAnswer();
        question.userAnswer = selectedAnswer; // Update the answer

        // Determine new status: 'answered-marked-review' if answered, otherwise 'marked-review'
        const newStatus = (selectedAnswer !== null) ? 'answered-marked-review' : 'marked-review';

        updateQuestionStatus(currentQuestionIndexInSection, newStatus);
        moveToNextQuestion(); // Load the next question
    }

    function clearResponse() {
        if (testSubmitted) return;
        if (currentQuestionGlobalIndex === -1) return;

        // Timer continues for the current question as we are not navigating away
        const question = testData[currentQuestionGlobalIndex];
        question.userAnswer = null; // Clear the stored answer

        // Determine new status: 'marked-review' if it was previously marked, otherwise 'not-answered'
        const newStatus = (question.status === 'marked-review' || question.status === 'answered-marked-review')
                         ? 'marked-review'
                         : 'not-answered';

        updateQuestionStatus(currentQuestionIndexInSection, newStatus); // Update status in data and palette

        // Clear the UI element
        if (question.type === 'mcq' && optionsContainer) {
            optionsContainer.querySelectorAll(`input[name="q${question.id}_options"]`).forEach(radio => radio.checked = false);
        } else if (question.type === 'integer' && optionsContainer) {
            const input = optionsContainer.querySelector('.integer-input');
            if (input) input.value = '';
        }
    }

    function moveToNextQuestion() {
        // Timer for the current question should have been stopped by the calling function (saveAndNext, markForReviewAndNext)
        const questionsInSection = getSectionQuestions();

        if (currentQuestionIndexInSection < questionsInSection.length - 1) {
            // Move to the next question within the current section
            loadQuestion(currentQuestionIndexInSection + 1); // loadQuestion will start the timer for the new one
        } else {
            // End of current section, try moving to the next section
            const currentSectionGlobalIndex = sections.indexOf(currentSection);
            if (currentSectionGlobalIndex < sections.length - 1) {
                // Switch to the first question of the next section
                switchSection(sections[currentSectionGlobalIndex + 1]); // switchSection handles timer stop/start via loadQuestion
            } else {
                 // Reached the end of the last section
                 alert("You have reached the end of the last section. Review your answers or submit.");
                 // The timer for the last question was already stopped. No new question is loaded.
                 // Ensure questionStartTime is null so no more time is recorded for the last question.
                 questionStartTime = null;
            }
        }
    }

    function jumpToQuestion(indexInSection) { // Parameter is index WITHIN the current section
        if (testSubmitted) return;
        const questions = getSectionQuestions();
        if (indexInSection >= 0 && indexInSection < questions.length && indexInSection !== currentQuestionIndexInSection) {
            stopQuestionTimer(); // Stop timer for the current question FIRST
            loadQuestion(indexInSection); // Load the clicked question (this will start its timer)
        } else if (indexInSection === currentQuestionIndexInSection) {
             // Clicking the currently active question in the palette - do nothing?
             console.log("Clicked active question in palette. No navigation needed.");
        } else {
             console.warn("Invalid index for jumpToQuestion:", indexInSection);
        }
    }

    function showSummary() {
        if (testSubmitted || !summaryOverlay || !summaryTableBody) return;

        stopQuestionTimer(); // Stop timer for the current question before showing summary

        // Generate summary table content based on current testData state
        summaryTableBody.innerHTML = ''; // Clear previous summary
        let totals = { total: 0, answered: 0, notAnswered: 0, markedReview: 0, answeredMarkedReview: 0, notVisited: 0 };

        sections.forEach(section => {
            const questionsInSection = testData.filter(q => q.section === section);
            const counts = { total: questionsInSection.length, answered: 0, notAnswered: 0, markedReview: 0, answeredMarkedReview: 0, notVisited: 0 };

            questionsInSection.forEach(q => {
                totals.total++; // Increment global total here
                switch (q.status) {
                    case 'answered': counts.answered++; break;
                    case 'not-answered': counts.notAnswered++; break;
                    case 'marked-review': counts.markedReview++; break;
                    case 'answered-marked-review': counts.answeredMarkedReview++; break;
                    case 'not-visited':
                    default: // Treat any unknown status as not-visited for summary
                         counts.notVisited++;
                         break;
                }
            });

            // Update global totals
            totals.answered += counts.answered;
            totals.notAnswered += counts.notAnswered;
            totals.markedReview += counts.markedReview;
            totals.answeredMarkedReview += counts.answeredMarkedReview;
            totals.notVisited += counts.notVisited;

            // Add row for this section
            const row = summaryTableBody.insertRow();
            row.innerHTML = `
                <td>${section}</td>
                <td>${counts.total}</td>
                <td>${counts.answered}</td>
                <td>${counts.notAnswered}</td>
                <td>${counts.markedReview}</td>
                <td>${counts.answeredMarkedReview}</td>
                <td>${counts.notVisited}</td>`;
        });

        // Add the total row
        const totalRow = summaryTableBody.insertRow();
        totalRow.style.fontWeight = 'bold';
        totalRow.innerHTML = `
            <td>Total</td>
            <td>${totals.total}</td>
            <td>${totals.answered}</td>
            <td>${totals.notAnswered}</td>
            <td>${totals.markedReview}</td>
            <td>${totals.answeredMarkedReview}</td>
            <td>${totals.notVisited}</td>`;

        summaryOverlay.style.display = 'flex'; // Show the summary overlay
    }

    // --- Result Calculation & Submission ---
    function submitTest() {
        if (testSubmitted) return;

        stopQuestionTimer(); // Stop timer for the current question one last time

        testSubmitted = true;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (timerEl) timerEl.textContent = formatTime(0);
        if (summaryOverlay) summaryOverlay.style.display = 'none'; // Hide summary if open

        // Disable UI elements
        const elementsToDisable = [
            saveNextBtn, markReviewBtn, clearResponseBtn, submitTestBtn, confirmSubmitBtn, cancelSubmitBtn,
            ...(sectionNav ? Array.from(sectionNav.querySelectorAll('button')) : []),
            ...(questionPalette ? Array.from(questionPalette.querySelectorAll('button')) : []),
            ...(optionsContainer ? Array.from(optionsContainer.querySelectorAll('input, button, label')) : [])
        ];
        elementsToDisable.forEach(el => {
            if (el) {
                el.disabled = true;
                // Special handling for labels associated with disabled inputs
                if (el.tagName === 'INPUT' && el.id) {
                    const label = document.querySelector(`label[for="${el.id}"]`);
                    if (label) label.style.cursor = 'default';
                } else if (el.tagName === 'LABEL') {
                    el.style.cursor = 'default';
                }
            }
        });
        // Also prevent clicks on the options container itself
        if (optionsContainer) {
            optionsContainer.style.pointerEvents = 'none';
            optionsContainer.style.opacity = '0.7'; // Visual cue
        }

        console.log("Test Submitted. Calculating and saving results...");

        // --- Calculate Results ---
        let overallScore = 0;
        let overallCorrect = 0;
        let overallIncorrect = 0;
        let overallUnattempted = 0;
        const sectionStats = {};
        const uniqueSections = [...new Set(testData.map(q => q.section))]; // Recalculate just in case

        uniqueSections.forEach(sec => {
            sectionStats[sec] = { score: 0, correct: 0, incorrect: 0, unattempted: 0, total: 0, maxMarks: 0 };
        });

        // Use the main testData array, which now contains userAnswer and timeSpent
        const processedTestData = testData; // We are modifying testData in place now

        processedTestData.forEach(q => {
            const scheme = MARKING_SCHEME[q.type] || { correct: 0, incorrect: 0, unattempted: 0 };
            let marksAwarded = 0;
            let resultStatus = 'unattempted'; // Default status

             // Ensure section exists in stats
            if (!sectionStats[q.section]) {
                 console.warn(`Section "${q.section}" missing in stats object for QID ${q.id}. Creating entry.`);
                 sectionStats[q.section] = { score: 0, correct: 0, incorrect: 0, unattempted: 0, total: 0, maxMarks: 0 };
            }
            sectionStats[q.section].total++;
            sectionStats[q.section].maxMarks += scheme.correct; // Assume positive marks for correct

            // Determine if the question was genuinely attempted (considering status and answer validity)
            let attempted = (q.status === 'answered' || q.status === 'answered-marked-review');
            if (attempted && q.userAnswer === null) {
                 // This case shouldn't strictly happen with current logic, but handles edge cases
                 attempted = false;
                 console.warn(`QID ${q.id} has status ${q.status} but null answer. Treating as unattempted.`);
            }
            if (q.type === 'integer' && attempted && String(q.userAnswer).trim() === '') {
                 // Integer input was touched but left blank
                 attempted = false;
            }

            // --- Calculate marks based on attempt status ---
            if (attempted) {
                let isCorrect = false;
                if (q.type === 'mcq') {
                    // Strict comparison for MCQ indices (should be numbers)
                    isCorrect = parseInt(q.userAnswer, 10) === parseInt(q.correctAnswer, 10);
                } else if (q.type === 'integer') {
                    // Allow for flexible comparison (e.g., '5' vs 5, '5.0' vs 5)
                    const userVal = String(q.userAnswer).trim();
                    const correctVal = String(q.correctAnswer).trim();
                     // Basic numeric comparison, might need refinement for precision issues
                     isCorrect = Number(userVal) === Number(correctVal);
                }

                if (isCorrect) {
                    marksAwarded = scheme.correct;
                    resultStatus = 'correct';
                    overallCorrect++;
                    sectionStats[q.section].correct++;
                } else {
                    marksAwarded = scheme.incorrect;
                    resultStatus = 'incorrect';
                    overallIncorrect++;
                    sectionStats[q.section].incorrect++;
                }
            } else { // Not attempted
                marksAwarded = scheme.unattempted;
                resultStatus = 'unattempted';
                overallUnattempted++;
                sectionStats[q.section].unattempted++;
                // Ensure userAnswer is null if not attempted for consistency in results data
                q.userAnswer = null;
            }

            // Store calculated results back into the question object
            q.marksAwarded = marksAwarded;
            q.resultStatus = resultStatus;

            // Update overall score and section score
            overallScore += marksAwarded;
            sectionStats[q.section].score += marksAwarded;
        });

        // Calculate overall max score for the summary
        const overallMaxScore = Object.values(sectionStats).reduce((sum, sec) => sum + (sec.maxMarks || 0), 0);

        // --- Prepare Final Data Structure for Saving ---
        const finalResults = {
            summary: {
                overallScore,
                overallCorrect,
                overallIncorrect,
                overallUnattempted,
                totalQuestions: processedTestData.length,
                maxScore: overallMaxScore, // Include max score
                sectionStats
            },
            // Create the detailed data array, ensuring chapter and timeSpent are included
            detailedData: processedTestData.map(q => ({
                id: q.id,
                section: q.section || 'Unknown Section',
                chapter: q.chapter || 'Uncategorized', // <<<--- ADDED CHAPTER HERE
                type: q.type,
                questionText: q.questionText,
                options: q.options, // Include options for review page
                correctAnswer: q.correctAnswer,
                userAnswer: q.userAnswer, // Already updated
                resultStatus: q.resultStatus, // Calculated status
                marksAwarded: q.marksAwarded, // Calculated marks
                timeSpent: Math.round((q.timeSpent || 0) * 100) / 100, // Round timeSpent to 2 decimal places
                solution: q.solution // Include solution if available
            }))
        };
        // --- End Calculation and Data Prep ---

        // --- Save to localStorage ---
        const resultEntry = {
            id: Date.now(), // Use timestamp as a unique ID
            timestamp: Date.now(), // Store timestamp explicitly for sorting/display
            testName: CURRENT_TEST_NAME,
            resultPageUrl: RESULT_PAGE_URL,
            summary: finalResults.summary,
            detailedData: finalResults.detailedData // Contains chapter and timeSpent
        };

        try {
            const existingResults = JSON.parse(localStorage.getItem('jeeMainResults') || '[]');
            existingResults.push(resultEntry);
            localStorage.setItem('jeeMainResults', JSON.stringify(existingResults));
            console.log("Results saved to localStorage successfully with chapter and time data.");

            // Redirect to results page if URL is provided
            if (RESULT_PAGE_URL) {
                window.location.href = RESULT_PAGE_URL;
            } else {
                console.warn("RESULT_PAGE_URL is not defined, staying on current page.");
                alert("Test submitted successfully. Results saved locally. (No redirect configured)");
            }
        } catch (error) {
            console.error("Failed to save results to localStorage:", error);
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            // Handle specific QuotaExceededError
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                alert("Could not save results: LocalStorage quota exceeded. Please clear some space in your browser's storage (e.g., old test results).");
            } else {
                alert("An error occurred while saving your results. Your test is submitted, but results might not be saved in your browser history.");
            }
        }
        // --- End Save ---
    }

    // --- Event Listeners Setup ---
    saveNextBtn?.addEventListener('click', saveAndNext);
    markReviewBtn?.addEventListener('click', markForReviewAndNext);
    clearResponseBtn?.addEventListener('click', clearResponse);
    submitTestBtn?.addEventListener('click', showSummary);
    confirmSubmitBtn?.addEventListener('click', submitTest);
    cancelSubmitBtn?.addEventListener('click', () => {
        if (summaryOverlay) summaryOverlay.style.display = 'none';
        // Restart timer for the current question if the user cancels submission?
        // This is debatable. Current logic doesn't restart it. User must navigate away/back.
        // If restart is needed: if (!testSubmitted && currentQuestionGlobalIndex !== -1) questionStartTime = Date.now();
    });
    // --- END Event Listeners ---

    // --- Initialization ---
    function initTest() {
        console.log(`Initializing test: ${CURRENT_TEST_NAME}`);
        loadMathJax(); // Initiate MathJax loading

        // Initialize question state (status, timeSpent, userAnswer)
        testData.forEach(q => {
            q.status = 'not-visited'; // Ensure all start as not visited
            q.timeSpent = 0;          // Initialize time spent
            q.userAnswer = null;      // Ensure answer is initially null
            // Chapter should already exist from the HTML definition
            if (!q.hasOwnProperty('chapter')) {
                 console.warn(`Question ID ${q.id} is missing the 'chapter' property.`);
                 q.chapter = 'Uncategorized'; // Add a fallback
            }
        });

        if (testTitleElement) {
            testTitleElement.textContent = CURRENT_TEST_NAME;
        } else {
            console.warn("Test title element (.header-left h1) not found.");
        }

        // Determine initial section and question index
        if (!currentSection && sections.length > 0) {
            currentSection = sections[0];
        }

        if (!currentSection) {
            console.error("No sections found in testData. Cannot initialize test.");
            alert("Error: Test data appears to be empty or invalid.");
            if (questionTextEl) questionTextEl.innerHTML = "Error: Test data could not be loaded.";
            if (optionsContainer) optionsContainer.innerHTML = "";
            return; // Stop initialization
        }

        currentQuestionGlobalIndex = testData.findIndex(q => q.section === currentSection);
        if (currentQuestionGlobalIndex === -1) {
            // Fallback if the determined currentSection somehow has no questions
            console.error(`Could not find any question for the initial section: ${currentSection}. Attempting fallback to first question.`);
            currentQuestionGlobalIndex = 0;
            currentSection = testData[0]?.section || null; // Adjust current section if fallback occurred
            if (!currentSection) { // Still no section? Fatal error.
                console.error("Fallback failed: No valid section or question found in testData.");
                return;
            }
        }
        // Find the index *within* the (potentially updated) currentSection
        const initialQuestionsInSection = getSectionQuestions();
        currentQuestionIndexInSection = initialQuestionsInSection.findIndex(q => q.id === testData[currentQuestionGlobalIndex]?.id);
        if (currentQuestionIndexInSection === -1) currentQuestionIndexInSection = 0; // Should not happen if global index is valid


        // Render initial UI state
        renderSectionTabs();
        renderQuestionPalette();

        // Load the first question (this will also start its timer)
        if (currentQuestionGlobalIndex < testData.length) {
             loadQuestion(currentQuestionIndexInSection);
        } else {
             console.error("Initial question index out of bounds. Cannot load first question.");
             // Display error message to user?
        }


        // Start the main test timer
        if (timeLeft > 0) {
            if (timerInterval) clearInterval(timerInterval); // Clear any previous interval
            timerInterval = setInterval(updateTimer, 1000);
            updateTimer(); // Initial display
        } else if (timerEl) {
            timerEl.textContent = formatTime(0); // Show 00:00:00 if duration is 0 or less
        }

        // Ensure summary is hidden initially
        if (summaryOverlay) summaryOverlay.style.display = 'none';

        console.log("Test initialized.");
    }

    // Start the test initialization process
    initTest();

}); // End of DOMContentLoaded listener