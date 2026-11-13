/* ==========================================================================
   feedback.js — Formspree feedback form (landing page)

   Setup: put your Formspree endpoint in the form's `action` attribute in
   index.html (https://formspree.io/f/YOUR_FORM_ID). Nothing else to change.

   The form sends with fetch() so the player stays on the page and sees a
   confirmation or error message. Without JavaScript it still works as a
   normal form post to Formspree.
   ========================================================================== */

(function () {
  "use strict";

  var form = document.getElementById("feedback-form");
  if (!form) return;

  var status = document.getElementById("fb-status");
  var submitBtn = document.getElementById("fb-submit");
  var label = submitBtn.querySelector(".btn__label");
  var idleText = label.textContent;
  var sending = false;

  var MSG_SUCCESS = "Message sent. Thanks for helping make XT\u00B3 better!";
  var MSG_ERROR = "Hmm, that didn't go through. Check your connection and try again.";
  var MSG_NOT_CONNECTED = "The feedback form isn't connected yet. Please try again later.";

  function showStatus(kind, text) {
    status.hidden = false;
    status.className = "form-status form-status--" + kind;
    status.setAttribute("role", kind === "error" ? "alert" : "status");
    status.textContent = text;
    status.focus();
  }

  function clearStatus() {
    status.hidden = true;
    status.textContent = "";
    status.className = "form-status";
    status.removeAttribute("role");
  }

  function setSending(on) {
    sending = on;
    submitBtn.disabled = on;
    submitBtn.setAttribute("aria-busy", String(on));
    label.textContent = on ? "Sending\u2026" : idleText;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending) return;

    // Placeholder endpoint still in place: don't send anything.
    if (/YOUR_FORM_ID/.test(form.action)) {
      if (window.console) console.warn("feedback.js: replace YOUR_FORM_ID in the form action with your Formspree form ID.");
      showStatus("error", MSG_NOT_CONNECTED);
      return;
    }

    clearStatus();
    setSending(true);

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" }
    })
      .then(function (res) {
        if (res.ok) {
          form.reset();
          showStatus("success", MSG_SUCCESS);
          return;
        }
        // Formspree explains validation problems in JSON; show it if present.
        return res.json().then(function (data) {
          var detail = data && data.errors && data.errors.map(function (er) { return er.message; }).join(" ");
          showStatus("error", detail ? "Couldn't send: " + detail : MSG_ERROR);
        }, function () {
          showStatus("error", MSG_ERROR);
        });
      })
      .catch(function () {
        showStatus("error", MSG_ERROR);
      })
      .then(function () {
        setSending(false);
      });
  });

  // Once the player edits a field again, drop the old message.
  form.addEventListener("input", function () {
    if (!status.hidden && !sending) clearStatus();
  });
})();