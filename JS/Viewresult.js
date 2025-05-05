// ==================================================================
// == Exam Results Dashboard & Detailed View Script ==
// ==================================================================

// Ensure this script is included AFTER Chart.js and AFTER the global constants are defined in the HTML.
// EXPECTED GLOBAL VARIABLES defined in HTML before this script:
// - TARGET_TEST_NAME (String, e.g., "JEE Main 8 April S2")
// - MAX_SCORE (Number, e.g., 300)
// - MARKS_CORRECT (Number, e.g., 4)
// - MARKS_INCORRECT (Number, e.g., -1)

document.addEventListener('DOMContentLoaded', () => {

    // --- MathJax Loading Function ---
    function loadMathJax() {
        if (typeof MathJax !== 'undefined') {
            return;
        }
        console.log("Script.js: Configuring and loading MathJax...");
        window.MathJax = {
            tex: {
                inlineMath: [['\\(', '\\)']],
                displayMath: [['\\[', '\\]']],
                processEscapes: true
            },
            svg: {
                fontCache: 'global'
            },
            options: {
                skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
            },
            startup: {
                ready: () => {
                    console.log('Script.js: MathJax is loaded and ready.');
                    MathJax.startup.defaultReady();
                }
            }
        };
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.id = 'MathJax-script-results';
        script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
        script.async = true;
        document.head.appendChild(script);
    }

    // --- Load MathJax ASAP ---
    loadMathJax();

    // --- Validate Required Global Variables ---
    if (typeof TARGET_TEST_NAME !== 'string' ||
        typeof MAX_SCORE !== 'number' ||
        typeof MARKS_CORRECT !== 'number' ||
        typeof MARKS_INCORRECT !== 'number') {
        console.error("FATAL: TARGET_TEST_NAME, MAX_SCORE, MARKS_CORRECT, or MARKS_INCORRECT are not defined globally in the HTML before script.js.");
        alert("Error: Results page configuration is missing. Cannot load results.");
        const selectAttemptMsgEl = document.getElementById('select-attempt-message');
        if (selectAttemptMsgEl) {
            selectAttemptMsgEl.innerHTML = '<p>Page configuration error. Please contact support or check the test setup.</p>';
            selectAttemptMsgEl.style.display = 'flex';
        }
        return; // Stop script execution
    }
    console.log("Global configuration loaded:", { TARGET_TEST_NAME, MAX_SCORE, MARKS_CORRECT, MARKS_INCORRECT });

    // --- DOM Element References ---
    const headerExamTitle = document.getElementById('exam-title');
    const headerExamDateTime = document.getElementById('exam-date-time');
    const headerScoreEl = document.getElementById('header-score');
    const headerMaxScoreEl = document.getElementById('header-max-score');
    const attemptsList = document.getElementById('attempts-list');
    const selectAttemptMessage = document.getElementById('select-attempt-message');
    const dashboardView = document.getElementById('dashboard-view');
    const detailedResultsArea = document.getElementById('detailed-results-area');
    const scorePieChartCanvas = document.getElementById('scorePieChart');
    const chartLegendEl = document.getElementById('chart-legend');
    const metricTimeEl = document.getElementById('metric-time');
    const metricAccuracyEl = document.getElementById('metric-accuracy');
    const metricAttemptedEl = document.getElementById('metric-attempted');
    const metricNegativeEl = document.getElementById('metric-negative');
    const timeCorrectEl = document.getElementById('time-correct');
    const timeWrongEl = document.getElementById('time-wrong');
    const timeNotAttemptedEl = document.getElementById('time-not-attempted');
    const sectionsTableBody = document.getElementById('sections-table-body');
    const viewAllQuestionsBtn = document.getElementById('view-all-questions-btn'); // On Dashboard
    const detailedSectionCardsContainer = document.getElementById('detailed-section-cards-container');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn'); // In Detailed View Header
    const printButton = document.getElementById('print-results-button'); // In Detailed View Header (Prints questions)
    const printDashboardBtn = document.getElementById('print-dashboard-btn'); // On Dashboard
    const attemptTimestampEl = document.getElementById('attempt-timestamp'); // In Detailed View Header
    const reviewSectionTabsContainer = document.getElementById('review-section-tabs'); // Container for section tabs
    const reviewQuestionsContainer = document.getElementById('review-questions-container'); // Container for question list

    // --- Chapter/Toggle View References ---
    const seeChapterwiseBtn = document.getElementById('see-chapterwise-btn');
    const viewBySectionBtn = document.getElementById('view-by-section-btn');
    const chapterSummaryView = document.getElementById('chapter-summary-view'); // Container for chapter cards
    const chapterQuestionsTitle = document.getElementById('chapter-questions-title'); // Title displayed above chapter questions

    // --- Modal DOM References ---
    const chapterAnalysisModal = document.getElementById('chapter-analysis-modal');
    const closeChapterModalBtn = document.getElementById('close-chapter-modal-btn');
    const chapterAnalysisTitle = document.getElementById('chapter-analysis-title');
    const chapterAnalysisTableContainer = document.getElementById('chapter-analysis-table-container');

    // --- State Variables ---
    let targetResults = [];
    let currentSelectedAttempt = null;
    let currentDetailedData = []; // Holds detailed data for the currently selected attempt
    let scorePieChart = null;

    // --- Define Predefined Section Order ---
    // Used for consistent sorting of sections across different displays
    const PREDEFINED_SECTION_ORDER = [
        'Physics (MCQ)', 'Physics (Integer)',
        'Chemistry (MCQ)', 'Chemistry (Integer)',
        'Maths (MCQ)', 'Maths (Integer)',
        'Mathematics (MCQ)', 'Mathematics (Integer)'
    ];

    // --- Custom Section Sorting Function ---
    function getSectionSortIndex(sectionName) {
        const index = PREDEFINED_SECTION_ORDER.indexOf(sectionName);
        // If not found, place it after predefined ones, sorting alphabetically among unknowns
        return index === -1 ? PREDEFINED_SECTION_ORDER.length + (sectionName?.length || 0) : index;
    }

    function sortSectionsCustom(sectionA, sectionB) {
        const indexA = getSectionSortIndex(sectionA);
        const indexB = getSectionSortIndex(sectionB);
        if (indexA !== indexB) {
            return indexA - indexB;
        }
        // Fallback to localeCompare if indices are the same (e.g., both not found or same predefined)
        return (sectionA || '').localeCompare(sectionB || '');
    }

    // --- Utility Functions ---
    function formatTime(totalSeconds) {
        if (isNaN(totalSeconds) || totalSeconds < 0) return "--";
        if (totalSeconds === 0) return "0s";

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        let parts = [];

        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0 || hours > 0) parts.push(`${minutes}m`); // Show minutes if hours > 0
        // Show seconds unless it's exactly 0 AND there are hours/minutes shown
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

        return parts.join(' ');
    }

    function formatTotalTime(totalSeconds) {
        if (isNaN(totalSeconds) || totalSeconds < 0) return "--:--:--";
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(Math.floor(totalSeconds % 60)).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function getLocalStorageData(key, defaultValue = []) {
        try {
            const storedValue = localStorage.getItem(key);
            return storedValue ? JSON.parse(storedValue) : defaultValue;
        } catch (error) {
            console.error(`Error reading or parsing localStorage key "${key}":`, error);
            return defaultValue;
        }
    }

    // --- Core Logic Functions ---

    /**
     * Loads results from localStorage, filters for the target test,
     * sorts them by time, and populates the sidebar attempts list.
     */
    function loadAndFilterAttempts() {
        // Reset header
        headerExamTitle.textContent = TARGET_TEST_NAME;
        headerMaxScoreEl.textContent = MAX_SCORE;
        headerScoreEl.textContent = '---';
        headerExamDateTime.textContent = 'Select an attempt';

        const allResults = getLocalStorageData('jeeMainResults', []);
        targetResults = allResults.filter(attempt =>
            attempt.testName === TARGET_TEST_NAME &&
            attempt.summary &&
            attempt.detailedData &&
            Array.isArray(attempt.detailedData)
        );

        attemptsList.innerHTML = ''; // Clear previous list

        if (targetResults.length === 0) {
            attemptsList.innerHTML = `<li class="no-attempts">No past attempts found for ${TARGET_TEST_NAME}.</li>`;
            selectAttemptMessage.style.display = 'flex';
            dashboardView.style.display = 'none';
            detailedResultsArea.style.display = 'none';
            return;
        }

        // Sort attempts (newest first) using timestamp or ID as fallback
        const getSortValue = (attempt) => {
            const ts = attempt?.timestamp;
            const id = attempt?.id;
            if (typeof ts === 'number' && !isNaN(ts)) return ts;
            if (typeof id === 'number' && !isNaN(id)) return id;
            if (typeof id === 'string') {
                const numericId = Number(id);
                if (!isNaN(numericId)) return numericId;
            }
            console.warn(`Attempt (ID: ${id}, TS: ${ts}) missing sortable time value.`);
            return Number.MIN_SAFE_INTEGER; // Ensure unsortable items go last/first consistently
        };
        targetResults.sort((a, b) => getSortValue(b) - getSortValue(a)); // Descending sort

        // Populate sidebar list
        targetResults.forEach((attempt, index) => {
            const listItem = document.createElement('li');
            listItem.dataset.attemptIndex = index;

            const score = attempt.summary?.overallScore ?? 'N/A';
            const attemptDate = new Date(attempt.timestamp || attempt.id);
            const dateString = isNaN(attemptDate) || getSortValue(attempt) === Number.MIN_SAFE_INTEGER ?
                'Unknown Date' :
                attemptDate.toLocaleString();

            listItem.innerHTML = `<span>${dateString}</span><span>Score: ${score}</span>`;

            listItem.addEventListener('click', () => {
                document.querySelectorAll('#attempts-list li.selected-attempt').forEach(el => el.classList.remove('selected-attempt'));
                listItem.classList.add('selected-attempt');
                currentSelectedAttempt = targetResults[index];
                console.log("Attempt selected:", currentSelectedAttempt.id);
                currentDetailedData = currentSelectedAttempt.detailedData || [];
                displayDashboardView(currentSelectedAttempt);
            });
            attemptsList.appendChild(listItem);
        });

        // Initial view state
        selectAttemptMessage.style.display = 'flex';
        dashboardView.style.display = 'none';
        detailedResultsArea.style.display = 'none';
    }

    /**
     * Displays the main dashboard view for the selected attempt.
     * Calculates overall stats, renders the pie chart, and the sections summary table.
     */
    function displayDashboardView(attemptData) {
        if (!attemptData || !attemptData.summary || !attemptData.detailedData) {
            console.error("Invalid attempt data for dashboard:", attemptData);
            alert("Error displaying dashboard: Data is incomplete.");
            return;
        }
        console.log("Displaying dashboard for attempt:", attemptData.id);

        const summary = attemptData.summary;
        const details = currentDetailedData; // Use the already populated state variable

        // --- Update Header ---
        headerExamTitle.textContent = attemptData.testName || TARGET_TEST_NAME;
        const attemptDate = new Date(attemptData.timestamp || attemptData.id);
        headerExamDateTime.textContent = `Attempt Time: ${isNaN(attemptDate) ? 'Unknown' : attemptDate.toLocaleString()}`;
        headerScoreEl.textContent = summary.overallScore ?? '---';
        headerMaxScoreEl.textContent = summary.maxScore ?? MAX_SCORE;

        // --- Calculate Overall Metrics ---
        const correct = summary.overallCorrect ?? 0;
        const incorrect = summary.overallIncorrect ?? 0;
        const unattempted = summary.overallUnattempted ?? 0;
        const totalQuestions = summary.totalQuestions ?? (correct + incorrect + unattempted);
        const attempted = correct + incorrect;
        const accuracy = attempted > 0 ? ((correct / attempted) * 100).toFixed(1) : '0.0';
        const penaltyPerIncorrect = Math.min(0, MARKS_INCORRECT || 0); // Ensure penalty isn't positive
        const negativeMarks = incorrect * penaltyPerIncorrect;

        // --- Calculate Time Metrics ---
        let totalTimeSpentSeconds = 0;
        let timeCorrectSeconds = 0;
        let timeWrongSeconds = 0;
        let timeNotAttemptedSeconds = 0;
        let sectionTimesSeconds = {};

        details.forEach(q => {
            const time = q.timeSpent || 0;
            totalTimeSpentSeconds += time;
            const section = q.section || 'Unknown';
            if (!sectionTimesSeconds[section]) {
                sectionTimesSeconds[section] = 0;
            }
            sectionTimesSeconds[section] += time;

            switch (q.resultStatus) {
                case 'correct':     timeCorrectSeconds += time; break;
                case 'incorrect':   timeWrongSeconds += time; break;
                case 'unattempted':
                default:            timeNotAttemptedSeconds += time; break;
            }
        });

        // --- Update DOM Metrics ---
        metricTimeEl.textContent = formatTotalTime(totalTimeSpentSeconds);
        metricAccuracyEl.textContent = `${accuracy}%`;
        metricAttemptedEl.textContent = `${attempted} / ${totalQuestions}`;
        metricNegativeEl.textContent = negativeMarks.toFixed(2);
        timeCorrectEl.textContent = formatTime(timeCorrectSeconds);
        timeWrongEl.textContent = formatTime(timeWrongSeconds);
        timeNotAttemptedEl.textContent = formatTime(timeNotAttemptedSeconds);

        // --- Render Pie Chart ---
        const chartData = {
            labels: [`Correct (${correct})`, `Wrong (${incorrect})`, `Not Attempted (${unattempted})`],
            datasets: [{
                data: [correct, incorrect, unattempted],
                backgroundColor: ['#10b981', '#ef4444', '#f59e0b'], // Green, Red, Amber
                hoverOffset: 4,
                borderColor: '#ffffff',
                borderWidth: 1
            }]
        };

        if (scorePieChart) {
            scorePieChart.destroy(); // Destroy previous chart instance
        }
        if (scorePieChartCanvas) {
            const ctx = scorePieChartCanvas.getContext('2d');
            scorePieChart = new Chart(ctx, {
                type: 'pie',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }, // Using custom legend
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    let label = context.label || '';
                                    if (label) { label += ': '; }
                                    if (context.parsed !== null) { label += context.parsed; }
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) + '%' : '0%';
                                    label += ` (${percentage})`;
                                    return label;
                                }
                            }
                        }
                    }
                }
            });

            // --- Render Custom Legend ---
            chartLegendEl.innerHTML = '';
            chartData.labels.forEach((label, index) => {
                const color = chartData.datasets[0].backgroundColor[index];
                const item = document.createElement('div');
                item.className = 'legend-item';
                item.innerHTML = `
                    <span class="legend-color-box" style="background-color: ${color};"></span>
                    <span>${label}</span>
                `;
                chartLegendEl.appendChild(item);
            });

        } else {
            console.warn("Pie chart canvas element not found.");
        }

        // --- Render Sections Summary Table ---
        sectionsTableBody.innerHTML = '';
        const sectionStats = summary.sectionStats || {};
        const sections = [...new Set(details.map(q => q.section).filter(Boolean))].sort(sortSectionsCustom);

        if (sections.length === 0) {
            sectionsTableBody.innerHTML = '<tr><td colspan="5">No section data available in detailed results.</td></tr>';
        } else {
            sections.forEach(sec => {
                const stats = sectionStats[sec] || { score: 0, correct: 0, incorrect: 0, unattempted: 0, total: 0, maxMarks: 0 };
                const secAttempted = stats.correct + stats.incorrect;
                const secAccuracy = secAttempted > 0 ? ((stats.correct / secAttempted) * 100) : 0;
                const secTimeSeconds = sectionTimesSeconds[sec] || 0;
                const secMaxMarks = stats.maxMarks || (stats.total * (MARKS_CORRECT || 0));
                const accClass = secAccuracy >= 80 ? 'good' : secAccuracy >= 50 ? 'medium' : 'bad';

                const row = sectionsTableBody.insertRow();
                row.innerHTML = `
                    <td>${sec}</td>
                    <td>${stats.score}/${secMaxMarks}</td>
                    <td><span class="accuracy-${accClass}">${secAccuracy.toFixed(1)}%</span></td>
                    <td>${secAttempted}/${stats.total}</td>
                    <td>${formatTime(secTimeSeconds)}</td>
                `;
            });
        }

        // --- Render Detailed Section Cards (for dashboard advanced analysis) ---
        detailedSectionCardsContainer.innerHTML = '';
        if (sections.length === 0) {
            detailedSectionCardsContainer.innerHTML = '<p>No detailed section analysis available.</p>';
        } else {
            sections.forEach(sec => {
                const stats = sectionStats[sec] || { score: 0, correct: 0, incorrect: 0, unattempted: 0, total: 0, maxMarks: 0 };
                const secTimeSeconds = sectionTimesSeconds[sec] || 0;
                const secAttempted = stats.correct + stats.incorrect;
                const secAccuracy = secAttempted > 0 ? ((stats.correct / secAttempted) * 100) : 0;
                const secTotalQuestions = stats.total || 0;
                const secMaxMarks = stats.maxMarks || (secTotalQuestions * (MARKS_CORRECT || 0));
                const accClass = secAccuracy >= 80 ? 'good' : secAccuracy >= 50 ? 'medium' : 'bad';
                const timeSpentFormatted = formatTotalTime(secTimeSeconds); // HH:MM:SS format for card

                const card = document.createElement('div');
                card.className = 'card section-detail-card';
                card.dataset.sectionName = sec;
                // --- MODIFICATION START ---
                // Removed "Marks" analysis button and "QUESTION MAP" button
                card.innerHTML = `
                    <div class="section-card-header">${sec}</div>
                    <div class="section-card-body">
                        <div class="stat-item"><span class="stat-label">Marks</span><span class="stat-value">${stats.score}/${secMaxMarks}</span></div>
                        <div class="stat-item"><span class="stat-label">Time</span><span class="stat-value">${timeSpentFormatted}</span></div>
                        <div class="stat-item"><span class="stat-label">Accuracy</span><span class="stat-value accuracy-${accClass}">${secAccuracy.toFixed(1)}%</span></div>
                        <div class="stat-item"><span class="stat-label">Attempted</span><span class="stat-value">${secAttempted}/${secTotalQuestions}</span></div>
                    </div>
                    <div class="advanced-analysis-links">
                        <h5>Advanced Analysis</h5>
                        <div class="analysis-options">
                            <button class="analysis-link" data-analysis-type="chapter" data-section="${sec}">Chapter <i class="fas fa-arrow-right"></i></button>
                            <button class="analysis-link" data-analysis-type="question_type" data-section="${sec}">Question Type <i class="fas fa-arrow-right"></i></button>
                            <!-- <button class="analysis-link" data-analysis-type="marks" data-section="${sec}">Marks <i class="fas fa-arrow-right"></i></button> -->
                        </div>
                    </div>
                    <div class="section-card-footer">
                        <!-- <button class="btn-question-map" data-section="${sec}">QUESTION MAP</button> -->
                        <button class="btn-view-section-questions" data-section="${sec}">VIEW QUESTIONS</button>
                    </div>
                `;
                // --- MODIFICATION END ---
                detailedSectionCardsContainer.appendChild(card);
            });
        }

        // --- Update View Visibility ---
        selectAttemptMessage.style.display = 'none';
        detailedResultsArea.style.display = 'none';
        dashboardView.style.display = 'flex'; // Show the dashboard

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * Switches the detailed view to show SECTION TABS and questions for a specific section.
     * Manages active state of view toggle buttons.
     * @param {string | null} sectionNameToFocus - The section tab to activate initially. If null, activates the first.
     * @param {boolean} activateTabs - Controls if tabs are generated and one is activated.
     */
    function displayDetailedQuestionView(sectionNameToFocus = null, activateTabs = true) {
        if (!currentSelectedAttempt || !currentDetailedData || currentDetailedData.length === 0) {
            console.error("Cannot display detailed view: No attempt selected or detailed data missing.");
            alert("Please select a valid attempt first.");
            return;
        }
        console.log(`Displaying detailed view (Sections). Focusing on section: ${sectionNameToFocus || 'First Available'}`);

        // --- Ensure Correct View Visibility ---
        selectAttemptMessage.style.display = 'none';
        dashboardView.style.display = 'none';
        detailedResultsArea.style.display = 'block'; // Show detailed area
        chapterSummaryView.style.display = 'none'; // Hide chapter summary cards
        chapterQuestionsTitle.style.display = 'none'; // Hide chapter-specific title
        reviewSectionTabsContainer.style.display = 'flex'; // Show section tabs container
        reviewQuestionsContainer.style.display = 'block'; // Show question list container
        if (printButton) printButton.disabled = false; // Enable print button for detailed view

        // --- Manage Toggle Button Active State ---
        if (viewBySectionBtn) viewBySectionBtn.classList.add('active');
        if (seeChapterwiseBtn) seeChapterwiseBtn.classList.remove('active');

        // --- Update Timestamp ---
        const attemptDate = new Date(currentSelectedAttempt.timestamp || currentSelectedAttempt.id);
        attemptTimestampEl.textContent = `Attempt Time: ${isNaN(attemptDate) ? 'Unknown' : attemptDate.toLocaleString()}`;

        // --- Manage Section Tabs ---
        const sections = [...new Set(currentDetailedData.map(q => q.section).filter(Boolean))].sort(sortSectionsCustom);
        reviewSectionTabsContainer.innerHTML = ''; // Clear existing tabs

        if (activateTabs && sections.length > 0) {
            let firstSection = sections[0];
            let targetSectionFound = false;

            sections.forEach((sec) => {
                const tab = document.createElement('button');
                tab.className = 'review-section-tab';
                tab.textContent = sec;
                tab.dataset.section = sec;

                // Determine active tab
                if (sectionNameToFocus && sec === sectionNameToFocus) {
                    tab.classList.add('active');
                    targetSectionFound = true;
                } else if (!sectionNameToFocus && sec === firstSection && !targetSectionFound) {
                    // Activate first tab if no specific focus or focus not found yet
                    tab.classList.add('active');
                    targetSectionFound = true; // Prevent activating another if focus is null
                }

                tab.addEventListener('click', (e) => {
                    const clickedTab = e.target;
                    // Deactivate all tabs, then activate the clicked one
                    reviewSectionTabsContainer.querySelectorAll('.review-section-tab').forEach(t => t.classList.remove('active'));
                    clickedTab.classList.add('active');
                    // Show questions only for this section
                    showDetailedReviewQuestions(clickedTab.dataset.section, currentDetailedData, true);
                });
                reviewSectionTabsContainer.appendChild(tab);
            });

            // Determine which section's questions to show initially
            const sectionToShowFirst = sectionNameToFocus && sections.includes(sectionNameToFocus) ?
                sectionNameToFocus :
                (sections.length > 0 ? sections[0] : null);

            if (sectionToShowFirst) {
                showDetailedReviewQuestions(sectionToShowFirst, currentDetailedData, true); // 'true' is important
            } else {
                reviewQuestionsContainer.innerHTML = '<p class="no-review-questions">No sections found to display.</p>';
            }

        } else if (!activateTabs) {
             // This case is mainly for printing all questions
             reviewSectionTabsContainer.style.display = 'none';
             // Render all questions for printing (sorted)
             let allQuestionsSorted = [...currentDetailedData].sort((qA, qB) => {
                 const sectionComparison = sortSectionsCustom(qA.section || '', qB.section || '');
                 if (sectionComparison !== 0) return sectionComparison;
                 // Fallback sort by original order/ID within a section
                 const idA = qA.id || currentDetailedData.indexOf(qA);
                 const idB = qB.id || currentDetailedData.indexOf(qB);
                 return idA - idB;
             });
             renderQuestionList(allQuestionsSorted, reviewQuestionsContainer, 'all'); // Render all for print

        } else { // No sections found
            reviewSectionTabsContainer.style.display = 'none';
            reviewQuestionsContainer.innerHTML = '<p class="no-review-questions">No questions or sections available in this attempt.</p>';
        }

        // --- Scroll to Top (only if user initiated view change, not for print pre-render) ---
        if (activateTabs) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    /**
     * Renders the list of questions filtered by SECTION into the review container.
     * This relies on renderQuestionList for the actual HTML generation.
     * @param {string} sectionName - The name of the section to display questions for.
     * @param {Array} detailedData - The full detailed data array for the attempt.
     * @param {boolean} onlyThisSection - Should always be true when called from section tabs.
     */
    function showDetailedReviewQuestions(sectionName, detailedData, onlyThisSection = true) {
        // This function is now specifically for showing section-based questions
        if (!onlyThisSection) {
            console.warn("showDetailedReviewQuestions called with onlyThisSection=false. Use renderQuestionList directly for non-section filtering.");
            // Fallback or specific handling if needed. For now, just filter by section.
        }

        const questionsToShow = detailedData.filter(q => q.section === sectionName);
        renderQuestionList(questionsToShow, reviewQuestionsContainer, 'section'); // Use common rendering function

        // Scroll the questions container to the top when a new section is selected
        if (reviewQuestionsContainer) {
            reviewQuestionsContainer.scrollTop = 0;
        }
    }

    /**
     * Renders a list of questions (can be filtered by chapter, section, or all)
     * into a specified container element. Handles MathJax typesetting.
     * @param {Array} questions - Array of question objects to render.
     * @param {HTMLElement} container - The DOM element to render the list into.
     * @param {string} context - 'section', 'chapter', or 'all' (used for messages and conditional rendering).
     */
    function renderQuestionList(questions, container, context = 'section') {
        container.innerHTML = ''; // Clear previous content

        if (!questions || questions.length === 0) {
            container.innerHTML = `<p class="no-review-questions">No questions found for this ${context}.</p>`;
            return;
        }

        questions.forEach((q, loopIndex) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'review-question-item';
            itemDiv.dataset.id = q.id; // Add question ID for potential future use

            // --- Determine Correct Answer Display ---
            let correctAnsDisplay = 'N/A';
            if (q.correctAnswer !== null && q.correctAnswer !== undefined) {
                if (q.type === 'mcq' && Array.isArray(q.options) && q.options[q.correctAnswer] !== undefined) {
                    // MCQ: Show option letter and text
                    correctAnsDisplay = `(${String.fromCharCode(65 + parseInt(q.correctAnswer))}) ${q.options[q.correctAnswer]}`;
                } else if (q.type === 'integer') {
                    // Integer: Show the number
                    correctAnsDisplay = q.correctAnswer;
                } else {
                    // Other types or fallback
                    correctAnsDisplay = String(q.correctAnswer);
                }
            }

            // --- Determine User Answer Display ---
            let userAnsDisplay = 'Not Answered';
            let userAnsClass = 'user-answer'; // Base class
            if (q.userAnswer !== null && q.userAnswer !== undefined && q.resultStatus !== 'unattempted') {
                if (q.type === 'mcq' && Array.isArray(q.options) && q.options[q.userAnswer] !== undefined) {
                    userAnsDisplay = `(${String.fromCharCode(65 + parseInt(q.userAnswer))}) ${q.options[q.userAnswer]}`;
                } else if (q.type === 'integer') {
                    userAnsDisplay = q.userAnswer;
                } else {
                    userAnsDisplay = String(q.userAnswer);
                }
                // Add styling for incorrect answers
                if (q.resultStatus === 'incorrect') {
                    userAnsClass += ' incorrect-ans';
                }
            }

            // --- Result Status Display ---
            const resultStatusDisplay = q.resultStatus || 'unknown';
            const statusClass = `review-status ${resultStatusDisplay}`; // e.g., "review-status correct"

            // --- Question Numbering (relative to the current list) ---
            const displayQNum = loopIndex + 1;

            // --- Build HTML using Template Literal ---
            itemDiv.innerHTML = `
                <div class="question-number">
                    Question ${displayQNum} (ID: ${q.id || 'N/A'})
                    ${context !== 'section' ? `[${q.section || 'Unknown Section'}]` : '' /* Show section if context is not section (e.g., 'all' or 'chapter') */}
                </div>
                <div class="question-text">
                    ${q.questionText || '[No Question Text Provided]'}
                </div>
                ${q.type === 'mcq' && Array.isArray(q.options) ? `
                    <div class="review-options">
                        ${q.options.map((opt, i) => `<div>(${String.fromCharCode(65 + i)}) ${opt}</div>`).join('')}
                    </div>
                ` : '' /* Only show options for MCQs */}
                <div class="review-details">
                    <div>Status: <span class="${statusClass}">${resultStatusDisplay.charAt(0).toUpperCase() + resultStatusDisplay.slice(1)}</span></div>
                    <div>Your Answer: <span class="${userAnsClass}">${userAnsDisplay}</span></div>
                    ${(resultStatusDisplay === 'incorrect' || resultStatusDisplay === 'unattempted') ? `
                        <div>Correct Answer: <span class="correct-answer">${correctAnsDisplay}</span></div>
                    ` : '' /* Show correct answer only if wrong or unattempted */}
                    <div>Marks: ${q.marksAwarded != null ? q.marksAwarded : 'N/A'}</div>
                    <div>Time Spent: ${formatTime(q.timeSpent || 0)}</div>
                </div>
                ${q.solution ? `
                    <div class="review-solution">
                        <strong>Solution:</strong>
                        <div>${q.solution}</div>
                    </div>
                ` : `
                    <div class="review-solution">
                        <strong>Solution:</strong>
                        <div>Not provided.</div>
                    </div>
                ` /* Show solution if available */}
            `;
            container.appendChild(itemDiv);
        });

        // --- Request MathJax Typesetting ---
        if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
            console.log(`Requesting MathJax typesetting for ${questions.length} questions in ${context} view.`);
            MathJax.typesetPromise([container])
                .then(() => {
                    console.log(`MathJax typesetting finished for ${context} view.`);
                })
                .catch((err) => console.error('MathJax typesetting error:', err));
        } else if (typeof MathJax === 'undefined') {
            console.warn(`MathJax not available. Typesetting skipped for ${context} view.`);
        }
    }

    /**
     * Calculates chapter stats across the entire attempt, displays them as cards in the detailed view,
     * and manages the active state of the view toggle buttons.
     */
    function showChapterSummaryView() {
        if (!currentSelectedAttempt || !currentDetailedData || currentDetailedData.length === 0) {
            console.error("Cannot show chapter summary: No attempt selected or detailed data missing.");
            alert("Please select a valid attempt first.");
            return;
        }
        console.log("Displaying Chapter Summary View");

        // --- Check if any question has chapter data ---
        const hasAnyChapterData = currentDetailedData.some(q => q.chapter && q.chapter !== 'Uncategorized');
        if (!hasAnyChapterData) {
             alert("Chapter information is not available for this test attempt.");
             chapterSummaryView.innerHTML = '<p style="padding: 20px; text-align: center;">Chapter information is not available for this test attempt.</p>';
             chapterSummaryView.style.display = 'block'; // Show the message container
             reviewSectionTabsContainer.style.display = 'none'; // Hide section tabs
             reviewQuestionsContainer.style.display = 'none'; // Hide question list
             chapterQuestionsTitle.style.display = 'none'; // Hide chapter title
             if(printButton) printButton.disabled = true; // Disable printing questions

             // --- Manage Toggle Button Active State ---
             if (viewBySectionBtn) viewBySectionBtn.classList.remove('active');
             if (seeChapterwiseBtn) seeChapterwiseBtn.classList.add('active');
             return; // Stop further processing
        }

        // --- Calculate Chapter Stats Globally ---
        const chapterStats = currentDetailedData.reduce((acc, q) => {
            const chapter = q.chapter || 'Uncategorized'; // Group questions without chapter info
            if (!acc[chapter]) {
                acc[chapter] = { total: 0, correct: 0, incorrect: 0, unattempted: 0, score: 0, time: 0, maxMarks: 0 };
            }

            acc[chapter].total++;
            acc[chapter].time += (q.timeSpent || 0);
            acc[chapter].score += (q.marksAwarded || 0);
            acc[chapter].maxMarks += (MARKS_CORRECT || 0); // Assuming constant marks per question

            switch (q.resultStatus) {
                case 'correct':     acc[chapter].correct++; break;
                case 'incorrect':   acc[chapter].incorrect++; break;
                case 'unattempted':
                default:            acc[chapter].unattempted++; break;
            }
            return acc;
        }, {});

        // --- Prepare and Display Chapter Cards ---
        chapterSummaryView.innerHTML = ''; // Clear previous cards
        const sortedChapters = Object.keys(chapterStats).sort((a, b) => a.localeCompare(b)); // Sort chapters alphabetically

        sortedChapters.forEach(chapter => {
            const data = chapterStats[chapter];
            const attempted = data.correct + data.incorrect;
            const accuracy = attempted > 0 ? ((data.correct / attempted) * 100).toFixed(1) : '0.0';

            const card = document.createElement('div');
            card.className = 'chapter-card';
            // Use template literal for card HTML
            card.innerHTML = `
                <h5>${chapter}</h5>
                <div class="chapter-stats-details">
                    <div class="stat-line">
                        <span class="stat-summary">
                            <span class="stat-correct">Correct ${data.correct}</span> •
                            <span class="stat-wrong">Wrong ${data.incorrect}</span> •
                            <span class="stat-none">None ${data.unattempted}</span>
                        </span>
                    </div>
                    <div class="stat-line">
                        <span class="stat-label">Score</span>
                        <span class="stat-value">${data.score}/${data.maxMarks}</span>
                    </div>
                    <div class="stat-line">
                        <span class="stat-label">Attempted</span>
                        <span class="stat-value">${attempted}/${data.total}</span>
                    </div>
                    <div class="stat-line">
                        <span class="stat-label">Time</span>
                        <span class="stat-value">${formatTime(data.time)}</span>
                    </div>
                    <div class="stat-line">
                        <span class="stat-label">Accuracy</span>
                        <span class="stat-value">${accuracy}%</span>
                    </div>
                </div>
                <button class="btn-view-chapter-questions" data-chapter="${chapter}">VIEW QUESTIONS</button>
            `;
            chapterSummaryView.appendChild(card);
        });

        // --- Toggle View Visibility ---
        reviewSectionTabsContainer.style.display = 'none'; // Hide section tabs
        reviewQuestionsContainer.style.display = 'none'; // Hide question list
        chapterQuestionsTitle.style.display = 'none'; // Hide chapter title
        chapterSummaryView.style.display = 'grid'; // Show chapter summary cards (using grid layout)
        if(printButton) printButton.disabled = true; // Disable printing questions from summary view

        // --- Manage Toggle Button Active State ---
        if (viewBySectionBtn) viewBySectionBtn.classList.remove('active');
        if (seeChapterwiseBtn) seeChapterwiseBtn.classList.add('active');
    }

     /**
      * Displays questions filtered by a specific chapter in the detailed view.
      * Manages the active state of the view toggle buttons.
      * @param {string} chapterName - The name of the chapter to filter by.
      */
     function displayQuestionsFilteredByChapter(chapterName) {
         if (!currentDetailedData) {
             console.error("Cannot filter by chapter: Detailed data not available.");
             return;
         }
         console.log(`Displaying questions filtered by Chapter: ${chapterName}`);

         const questionsToShow = currentDetailedData.filter(q => q.chapter === chapterName);

         // --- Update Title ---
         if (chapterQuestionsTitle) {
             chapterQuestionsTitle.textContent = `Questions & Solutions for Chapter: ${chapterName}`;
             chapterQuestionsTitle.style.display = 'block'; // Show the title
         }

         // --- Render Questions ---
         renderQuestionList(questionsToShow, reviewQuestionsContainer, 'chapter');

         // --- Toggle View Visibility ---
         chapterSummaryView.style.display = 'none'; // Hide chapter cards
         reviewSectionTabsContainer.style.display = 'none'; // Keep section tabs hidden
         reviewQuestionsContainer.style.display = 'block'; // Show question list
         if(printButton) printButton.disabled = false; // Re-enable printing now that questions are shown

         // --- Manage Toggle Button Active State ---
         // Keep 'See Chapterwise' active as we drilled down from there
         if (viewBySectionBtn) viewBySectionBtn.classList.remove('active');
         if (seeChapterwiseBtn) seeChapterwiseBtn.classList.add('active');

         // --- Scroll to the top of the detailed results area ---
         window.scrollTo({ top: detailedResultsArea.offsetTop, behavior: 'smooth' });
         reviewQuestionsContainer.scrollTop = 0; // Also scroll the inner container
     }

     /**
     * Calculates and displays chapter-wise analysis for a specific SECTION in a modal.
     * (Triggered from the Dashboard Section Cards' "Advanced Analysis -> Chapter" button)
     * @param {string} sectionName - The section to analyze.
     */
    function displayChapterAnalysis(sectionName) {
        if (!currentDetailedData) {
            console.error("Detailed data not available for chapter analysis.");
            alert("Error: Could not load detailed data for analysis.");
            return;
        }

        const sectionQuestions = currentDetailedData.filter(q => q.section === sectionName);

        if (sectionQuestions.length === 0) {
            chapterAnalysisTitle.textContent = `Chapter Analysis for: ${sectionName}`;
            chapterAnalysisTableContainer.innerHTML = '<p>No questions found in this section.</p>';
            if (chapterAnalysisModal) {
                chapterAnalysisModal.style.display = 'flex';
                setTimeout(() => chapterAnalysisModal.classList.add('visible'), 10);
            }
            return;
        }

        const hasChapterData = sectionQuestions.some(q => q.chapter && q.chapter !== 'Uncategorized');
        if (!hasChapterData) {
            chapterAnalysisTitle.textContent = `Chapter Analysis for: ${sectionName}`;
            chapterAnalysisTableContainer.innerHTML = '<p>Chapter information is not available for the questions in this section.</p>';
            if (chapterAnalysisModal) {
                chapterAnalysisModal.style.display = 'flex';
                setTimeout(() => chapterAnalysisModal.classList.add('visible'), 10);
            }
            return;
        }

        // --- Calculate Chapter Stats within the Section ---
        const chapterData = sectionQuestions.reduce((acc, q) => {
            const chapter = q.chapter || 'Uncategorized';
            if (!acc[chapter]) {
                acc[chapter] = { total: 0, correct: 0, incorrect: 0, unattempted: 0, score: 0, time: 0, maxMarks: 0 };
            }
            acc[chapter].total++;
            acc[chapter].time += (q.timeSpent || 0);
            acc[chapter].score += (q.marksAwarded || 0);
            acc[chapter].maxMarks += (MARKS_CORRECT || 0);
            switch (q.resultStatus) {
                case 'correct':     acc[chapter].correct++; break;
                case 'incorrect':   acc[chapter].incorrect++; break;
                case 'unattempted': default: acc[chapter].unattempted++; break;
            }
            return acc;
        }, {});

        // --- Generate HTML Table for Modal ---
        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Chapter</th>
                        <th>Total Qs</th>
                        <th>Correct</th>
                        <th>Incorrect</th>
                        <th>Unattempted</th>
                        <th>Score</th>
                        <th>Accuracy (%)</th>
                        <th>Time Spent</th>
                    </tr>
                </thead>
                <tbody>
        `;

        const sortedChapters = Object.keys(chapterData).sort((a, b) => a.localeCompare(b));

        if (sortedChapters.length === 0) {
            tableHTML += `<tr><td colspan="8">No chapter data found for this section.</td></tr>`;
        } else {
            sortedChapters.forEach(chapter => {
                const data = chapterData[chapter];
                const attempted = data.correct + data.incorrect;
                const accuracy = attempted > 0 ? ((data.correct / attempted) * 100).toFixed(1) : '0.0';
                const accuracyClass = accuracy >= 80 ? 'accuracy-good' : accuracy >= 50 ? 'accuracy-medium' : 'accuracy-bad';
                const formattedTime = formatTime(data.time);
                tableHTML += `
                    <tr>
                        <td>${chapter}</td>
                        <td>${data.total}</td>
                        <td>${data.correct}</td>
                        <td>${data.incorrect}</td>
                        <td>${data.unattempted}</td>
                        <td>${data.score}/${data.maxMarks}</td>
                        <td class="${accuracyClass}">${accuracy}%</td>
                        <td>${formattedTime}</td>
                    </tr>
                `;
            });
        }
        tableHTML += `</tbody></table>`;

        // --- Display Modal ---
        if (chapterAnalysisModal && chapterAnalysisTitle && chapterAnalysisTableContainer) {
            chapterAnalysisTitle.textContent = `Chapter Analysis for: ${sectionName}`;
            chapterAnalysisTableContainer.innerHTML = tableHTML;
            chapterAnalysisModal.style.display = 'flex'; // Make modal block visible
            setTimeout(() => chapterAnalysisModal.classList.add('visible'), 10); // Add class for transition
        } else {
            console.error("Chapter analysis modal elements not found in the DOM.");
            alert("Error: Could not display the analysis results window.");
        }
    }


    // --- Event Handlers ---

    /**
     * Handles clicks within the detailed section cards on the DASHBOARD using event delegation.
     * Triggers actions like viewing section questions or opening analysis modals.
     */
    function handleDetailedCardClick(event) {
        const target = event.target;
        const sectionCard = target.closest('.section-detail-card');
        const analysisLink = target.closest('.analysis-link');
        const viewQuestionsBtn = target.closest('.btn-view-section-questions');
        // --- MODIFICATION START ---
        // Removed reference to questionMapBtn as it's no longer generated
        // const questionMapBtn = target.closest('.btn-question-map');
        // --- MODIFICATION END ---


        if (!sectionCard || !currentSelectedAttempt) return; // Click not on a card or no attempt selected

        const sectionName = sectionCard.dataset.sectionName;

        if (viewQuestionsBtn) {
            console.log(`View Questions clicked for: ${sectionName}`);
            displayDetailedQuestionView(sectionName, true); // Switch to detailed view, focus this section
        // --- MODIFICATION START ---
        // Removed else if block for questionMapBtn
        // } else if (questionMapBtn) {
        //    console.log(`Question Map clicked for: ${sectionName}`);
        //    alert(`Functionality for 'Question Map' (Section: ${sectionName}) is not yet implemented.`);
        // }
        // --- MODIFICATION END ---
        } else if (analysisLink) {
            const analysisType = analysisLink.dataset.analysisType;
            console.log(`Advanced Analysis clicked: Type=${analysisType}, Section=${sectionName}`);
            if (analysisType === 'chapter') {
                displayChapterAnalysis(sectionName); // Show chapter breakdown in modal
            // --- MODIFICATION START ---
            // Removed check for 'marks' analysis type as the button is gone
            // } else if (analysisType === 'marks') {
            //    alert(`Functionality for 'Advanced Analysis - ${analysisType}' (Section: ${sectionName}) is not yet implemented.`);
            // }
            // --- MODIFICATION END ---
            } else { // Handles 'question_type' and potentially future types
                alert(`Functionality for 'Advanced Analysis - ${analysisType}' (Section: ${sectionName}) is not yet implemented.`);
            }
        }
    }

    /**
     * Handles clicks within the chapter summary view (delegated from chapterSummaryView container).
     * Specifically listens for clicks on 'VIEW QUESTIONS' buttons on chapter cards.
     */
    function handleChapterSummaryClick(event) {
        const target = event.target;
        // Check if the clicked element is the button and has the chapter data attribute
        if (target.classList.contains('btn-view-chapter-questions') && target.dataset.chapter) {
            const chapterName = target.dataset.chapter;
            console.log(`View Questions clicked for Chapter: ${chapterName}`);
            displayQuestionsFilteredByChapter(chapterName); // Show questions for this chapter
        }
    }

    /**
     * Handles printing the DETAILED question view.
     * IMPORTANT: This function renders and prints ALL questions from the attempt,
     * regardless of the currently selected section or chapter filter, for a complete report.
     */
    function handlePrintButtonClick() {
        console.log("Detailed Print button clicked (will render and print ALL questions).");
        if (!currentDetailedData || currentDetailedData.length === 0) {
            alert("No detailed data to print.");
            return;
        }

        console.log("Rendering all questions for printing...");
        // Ensure the correct view elements are visible/hidden for printing
        document.body.classList.remove('printing-dashboard'); // Ensure dashboard print styles are off
        chapterSummaryView.style.display = 'none';
        chapterQuestionsTitle.style.display = 'none';
        reviewSectionTabsContainer.style.display = 'none'; // Hide tabs for printing
        reviewQuestionsContainer.style.display = 'block';

        // Sort all questions consistently (by section, then by original order/ID)
        let allQuestionsSorted = [...currentDetailedData].sort((qA, qB) => {
            const sectionComparison = sortSectionsCustom(qA.section || '', qB.section || '');
            if (sectionComparison !== 0) return sectionComparison;
            const idA = qA.id || currentDetailedData.indexOf(qA); // Use index as fallback ID
            const idB = qB.id || currentDetailedData.indexOf(qB);
            return idA - idB;
        });

        // Render the sorted list of all questions into the container
        renderQuestionList(allQuestionsSorted, reviewQuestionsContainer, 'all');

        // Use a short timeout to allow rendering (especially MathJax) before printing
        setTimeout(() => {
            console.log("Calling window.print() for detailed view...");
            window.print();
            // Note: Styles specifically for printing should be handled via @media print CSS rules.
        }, 750); // Adjust timeout if needed based on rendering complexity
    }

    /**
     * Handles printing the DASHBOARD summary view.
     * Adds a temporary class to the body for print-specific styling.
     */
    function handlePrintDashboardClick() {
        console.log("Print Dashboard button clicked.");
        if (!currentSelectedAttempt) {
            alert("Please select an attempt first to print its dashboard.");
            return;
        }

        // Optional: Warn user this only prints the summary
        alert("You are about to print the dashboard summary.\nFor printing all questions and answers, please go to 'View All Questions' first, then use the 'Print Results' button there.\n\nClick OK to print only the dashboard summary.");

        document.body.classList.add('printing-dashboard');
        console.log("Added .printing-dashboard class to body.");

        // Use a short timeout to allow the class change to potentially affect layout/styles
        setTimeout(() => {
            console.log("Calling window.print() for dashboard...");
            window.print();
            // Clean up the class after printing (in a timeout to ensure print dialog is processed)
            setTimeout(() => {
                document.body.classList.remove('printing-dashboard');
                console.log("Removed .printing-dashboard class from body.");
            }, 500); // Delay removal slightly
        }, 250);
    }

    // --- Event Listener Setup ---

    // Dashboard: Clicks within the detailed section cards (for analysis/view questions buttons)
    if (detailedSectionCardsContainer) {
        detailedSectionCardsContainer.addEventListener('click', handleDetailedCardClick);
    } else { console.warn("Detailed section cards container not found. Dashboard card interactions disabled."); }

    // Dashboard: 'View All Questions' button
    if (viewAllQuestionsBtn) {
        viewAllQuestionsBtn.addEventListener('click', () => {
            if (currentSelectedAttempt && currentDetailedData.length > 0) {
                // Determine the first section to show by default
                const firstSection = [...new Set(currentDetailedData.map(q => q.section).filter(Boolean))]
                                     .sort(sortSectionsCustom)[0];
                displayDetailedQuestionView(firstSection, true); // Switch to detailed view
            } else {
                alert("Please select an attempt with data first.");
            }
        });
    } else { console.warn("View All Questions button (view-all-questions-btn) not found."); }

    // Detailed View: 'Back to Dashboard' button
    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', () => {
            if (currentSelectedAttempt) {
                displayDashboardView(currentSelectedAttempt); // Go back to dashboard
            } else {
                // Should ideally not happen if back button is only visible with an attempt, but handle defensively
                selectAttemptMessage.style.display = 'flex';
                dashboardView.style.display = 'none';
                detailedResultsArea.style.display = 'none';
            }
        });
    } else { console.warn("Back to Dashboard button (back-to-dashboard-btn) not found."); }

    // Detailed View: 'Print Results' button (prints all questions)
    if (printButton) {
        printButton.addEventListener('click', handlePrintButtonClick);
    } else { console.warn("Detailed Print button (print-results-button) not found."); }

    // Dashboard: 'Print Dashboard' button
    if (printDashboardBtn) {
        printDashboardBtn.addEventListener('click', handlePrintDashboardClick);
    } else { console.warn("Print Dashboard button (print-dashboard-btn) not found."); }

    // --- Detailed View Toggle/Chapter Buttons ---

    // 'See Chapterwise Analysis' button
    if (seeChapterwiseBtn) {
        seeChapterwiseBtn.addEventListener('click', showChapterSummaryView);
    } else { console.warn("See Chapterwise button (see-chapterwise-btn) not found."); }

    // 'View By Section' button
    if (viewBySectionBtn) {
        viewBySectionBtn.addEventListener('click', () => {
            if (currentSelectedAttempt && currentDetailedData.length > 0) {
                 // Determine the first section to show when switching back to section view
                const firstSection = [...new Set(currentDetailedData.map(q => q.section).filter(Boolean))]
                                     .sort(sortSectionsCustom)[0];
                displayDetailedQuestionView(firstSection, true); // Go back to section view
            } else {
                 alert("Please select an attempt first."); // Or handle as appropriate if button is somehow visible
            }
        });
    } else { console.warn("View By Section button (view-by-section-btn) not found."); }

    // Detailed View (Chapter Summary): Clicks on 'View Questions' buttons on chapter cards (Delegated)
    if (chapterSummaryView) {
        chapterSummaryView.addEventListener('click', handleChapterSummaryClick);
    } else { console.warn("Chapter summary view container (chapter-summary-view) not found. Chapter question viewing disabled."); }

    // --- Modal Listeners (for Chapter Analysis Modal) ---

    // Close button inside the modal
    if (closeChapterModalBtn) {
        closeChapterModalBtn.addEventListener('click', () => {
            if (chapterAnalysisModal) {
                chapterAnalysisModal.classList.remove('visible');
                // Use setTimeout to wait for transition before setting display: none
                setTimeout(() => chapterAnalysisModal.style.display = 'none', 300); // Match transition duration
            }
        });
    } else { console.warn("Chapter analysis modal close button (close-chapter-modal-btn) not found."); }

    // Clicking outside the modal content (on the overlay) to close
    if (chapterAnalysisModal) {
        chapterAnalysisModal.addEventListener('click', (event) => {
            // Close only if the click is directly on the modal overlay itself
            if (event.target === chapterAnalysisModal) {
                chapterAnalysisModal.classList.remove('visible');
                setTimeout(() => chapterAnalysisModal.style.display = 'none', 300);
            }
        });
    } else { console.warn("Chapter analysis modal overlay (chapter-analysis-modal) not found."); }


    // --- Initial Load ---
    // Load attempts from localStorage and populate the sidebar when the DOM is ready.
    loadAndFilterAttempts();

}); // --- End of DOMContentLoaded ---