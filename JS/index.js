// js/testmain.js

/**
 * Handles showing/hiding paper lists based on clicked exam tab.
 * Manages active states using CSS classes.
 */
document.addEventListener('DOMContentLoaded', () => {

    // Get all the clickable exam tabs
    const examTabs = document.querySelectorAll('.subject-card-button');

    // Get all the paper list containers
    const paperLists = document.querySelectorAll('.paper-list');

    // Basic checks
    if (examTabs.length === 0) {
        console.warn("No exam tabs found with class 'subject-card-button'.");
        return;
    }
    if (paperLists.length === 0) {
        console.warn("No paper list containers found with class 'paper-list'.");
        return;
    }

    // --- Function to deactivate all tabs and lists ---
    function deactivateAll() {
        // Remove 'active' class from all tabs
        examTabs.forEach(tab => {
            tab.classList.remove('active');
        });

        // Hide all paper lists and remove specific active classes
        paperLists.forEach(list => {
            list.classList.remove('active-list'); // Hide content list (using CSS)

            // Remove specific heading border classes (e.g., JEEMAIN-list-active)
            const classesToRemove = [];
            list.classList.forEach(cls => {
                if (cls.endsWith('-list-active')) {
                    classesToRemove.push(cls);
                }
            });
             if (classesToRemove.length > 0) {
                list.classList.remove(...classesToRemove);
             }
        });
    }

    // Add a click event listener to each exam tab
    examTabs.forEach(button => {
        button.addEventListener('click', () => {
            // Get the subject identifier (e.g., "JEE MAIN") from the data attribute
            const subjectName = button.dataset.subject;
            if (!subjectName) {
                console.error("Clicked tab is missing 'data-subject' attribute:", button);
                return;
            }

            // --- Deactivate everything first ---
            deactivateAll();

            // --- Activate the clicked tab visually ---
            button.classList.add('active'); // Add active class to the clicked button

            // --- Generate ID and active class for the target list ---
            // Normalize the subject name (e.g., remove spaces, uppercase for consistency)
            const subjectKey = subjectName.replace(/\s+/g, '').toUpperCase(); // e.g., JEEMAIN
            const targetListId = `${subjectKey}-papers`;                 // e.g., JEEMAIN-papers
            const targetListActiveClass = `${subjectKey}-list-active`;   // Class for heading border

            // --- Find and activate the target paper list ---
            const targetList = document.getElementById(targetListId);
            if (targetList) {
                targetList.classList.add('active-list');         // Show the list (via CSS)
                targetList.classList.add(targetListActiveClass); // Style the heading (via CSS)

            } else {
                console.error(`Paper list container with ID "${targetListId}" not found.`);
            }
        });
    });

    // --- Activate the first tab by default on page load ---
    if (examTabs.length > 0) {
         const initiallyActive = document.querySelector('.subject-card-button.active');
         if (!initiallyActive) {
            const firstSubjectName = examTabs[0].dataset.subject;
            if (firstSubjectName) {
                 const firstSubjectKey = firstSubjectName.replace(/\s+/g, '').toUpperCase();
                 const firstListId = `${firstSubjectKey}-papers`;
                 if (document.getElementById(firstListId)) {
                     examTabs[0].click();
                 }
            }
         } else {
             initiallyActive.click();
         }
    }

}); // End DOMContentLoaded listener