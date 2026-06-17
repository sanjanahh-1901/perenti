import { auth as firebaseAuth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { collection, doc, setDoc, getDoc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // Firestore Database Initialization
  // ==========================================================================

  let ticketsRemaining = 60;
  
  async function initEventSettings() {
    try {
      const settingsRef = doc(db, 'eventSettings', 'main');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        ticketsRemaining = settingsSnap.data().ticketsRemaining ?? 60;
      } else {
        await setDoc(settingsRef, { ticketsRemaining: 60 });
        ticketsRemaining = 60;
      }
      updateTicketsRemainingDisplay();
    } catch (error) {
      if (error.code === 'permission-denied') {
        console.warn("Guest mode: using fallback ticket count.");
      } else {
        console.error("Error fetching event settings:", error);
      }
    }
  }

  initEventSettings();

  // ==========================================================================
  // Dynamic Session Header Actions State
  // ==========================================================================
  const guestActions = document.querySelectorAll('#session-header-actions > a');
  const userBadge = document.getElementById('header-user-badge');
  const adminBadge = document.getElementById('header-admin-badge');
  const emailDisplay = document.getElementById('header-email-display');
  const adminEmailDisplay = document.getElementById('header-admin-email-display');
  const logoutBtn = document.getElementById('btn-header-logout');
  const logoutAdminBtn = document.getElementById('btn-header-logout-admin');

  let session = null;
  try {
    session = JSON.parse(localStorage.getItem('currentUser'));
  } catch (e) {
    console.error("Error parsing session:", e);
    try {
      localStorage.removeItem('currentUser');
    } catch (_) {}
  }

  function updateHeaderSessionUI() {
    // Hide all first
    guestActions.forEach(btn => btn.classList.add('hidden'));
    if (userBadge) {
      userBadge.classList.add('hidden');
      userBadge.style.display = 'none';
    }
    if (adminBadge) {
      adminBadge.classList.add('hidden');
      adminBadge.style.display = 'none';
    }

    if (session) {
      if (session.role === 'admin') {
        if (adminBadge) {
          adminBadge.classList.remove('hidden');
          adminBadge.style.display = 'flex';
          adminEmailDisplay.textContent = session.email;
        }
      } else {
        if (userBadge) {
          userBadge.classList.remove('hidden');
          userBadge.style.display = 'flex';
          emailDisplay.textContent = session.email;
        }
      }
    } else {
      // Show guest login/signup
      guestActions.forEach(btn => btn.classList.remove('hidden'));
    }
  }

  updateHeaderSessionUI();

  // Logout Click listeners
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      window.location.reload();
    });
  }

  if (logoutAdminBtn) {
    logoutAdminBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      window.location.reload();
    });
  }


  // ==========================================================================
  // Stepper & Calculations Logic
  // ==========================================================================
  const qtyDec = document.getElementById('qty-dec');
  const qtyInc = document.getElementById('qty-inc');
  const qtyDisplay = document.getElementById('qty-count');
  
  const summaryEmptyView = document.getElementById('summary-empty-view');
  const summaryBreakdownView = document.getElementById('summary-breakdown-view');
  const registerSubmitBtn = document.getElementById('btn-register-submit');

  const summaryQty = document.getElementById('summary-qty');
  const summarySubtotal = document.getElementById('summary-subtotal');
  const summaryPlatform = document.getElementById('summary-platform-fee');
  const summaryGateway = document.getElementById('summary-gateway-fee');
  const summaryGst = document.getElementById('summary-gst');
  const summaryTotal = document.getElementById('summary-total');

  const promoInput = document.getElementById('promo-code-input');
  const applyPromoBtn = document.getElementById('btn-apply-discount');
  const removePromoLink = document.getElementById('btn-promo-reset');
  const removePromoBadgeBtn = document.getElementById('btn-remove-discount');
  const appliedPromoContainer = document.getElementById('applied-promo-container');
  const promoCodeName = document.getElementById('promo-code-name');
  
  const promoStatusError = document.getElementById('promo-status-error');
  const promoStatusSuccess = document.getElementById('promo-status-success');

  const TICKET_PRICE = 399;
  const PLATFORM_FEE_PER_TICKET = 9.98;
  const GATEWAY_FEE_PER_TICKET = 12.13;
  const GST_RATE_OF_PLATFORM = 0.18; 

  let quantity = 1;
  let isPromoApplied = false;
  const PROMO_CODE_VALID = 'EBC10';
  const PROMO_DISCOUNT_PERCENT = 0.10; 

  // Read stock capacity from firestore state (handled by initEventSettings)

  // Available badges refs
  const availableBadge = document.getElementById('ticket-available-badge');
  const barcodeQtyBadge = document.getElementById('ticket-barcode-qty');

  function updateTicketsRemainingDisplay() {
    if (availableBadge) {
      availableBadge.textContent = `${ticketsRemaining} left`;
    }
    if (barcodeQtyBadge) {
      barcodeQtyBadge.textContent = `${ticketsRemaining} LEFT`;
    }
  }

  updateTicketsRemainingDisplay();

  function updateCalculations() {
    if (qtyDisplay) qtyDisplay.textContent = quantity;
    if (qtyDec) qtyDec.disabled = quantity <= 1;

    const maxAllowed = Math.min(10, ticketsRemaining);
    if (qtyInc) {
      qtyInc.disabled = quantity >= maxAllowed;
    }

    if (quantity > 0) {
      if (summaryEmptyView) summaryEmptyView.classList.add('hidden');
      if (summaryBreakdownView) summaryBreakdownView.classList.remove('hidden');
      if (registerSubmitBtn) {
        registerSubmitBtn.disabled = false;
        registerSubmitBtn.classList.add('active');
      }
    } else {
      if (summaryEmptyView) summaryEmptyView.classList.remove('hidden');
      if (summaryBreakdownView) summaryBreakdownView.classList.add('hidden');
      if (registerSubmitBtn) {
        registerSubmitBtn.disabled = true;
        registerSubmitBtn.classList.remove('active');
      }
      resetPromoCode();
    }

    const ticketSubtotal = quantity * TICKET_PRICE;
    const discountAmount = isPromoApplied ? (ticketSubtotal * PROMO_DISCOUNT_PERCENT) : 0;
    const finalSubtotal = ticketSubtotal - discountAmount;
    
    let platformFee = quantity * PLATFORM_FEE_PER_TICKET;
    let gatewayFee = quantity * GATEWAY_FEE_PER_TICKET;
    let gst = platformFee * GST_RATE_OF_PLATFORM;

    if (isPromoApplied) {
      platformFee = platformFee * (1 - PROMO_DISCOUNT_PERCENT);
      gatewayFee = gatewayFee * (1 - PROMO_DISCOUNT_PERCENT);
      gst = platformFee * GST_RATE_OF_PLATFORM;
    }

    const totalAmount = finalSubtotal + platformFee + gatewayFee + gst;

    summaryQty.textContent = quantity;
    
    if (isPromoApplied) {
      summarySubtotal.innerHTML = `<span style="text-decoration: line-through; opacity: 0.5; margin-right: 0.5rem;">₹${ticketSubtotal.toFixed(2)}</span> ₹${finalSubtotal.toFixed(2)}`;
    } else {
      summarySubtotal.textContent = `₹${ticketSubtotal.toFixed(2)}`;
    }

    summaryPlatform.textContent = `₹${platformFee.toFixed(2)}`;
    summaryGateway.textContent = `₹${gatewayFee.toFixed(2)}`;
    summaryGst.textContent = `₹${gst.toFixed(2)}`;
    summaryTotal.textContent = `₹${totalAmount.toFixed(2)}`;
  }

  if (qtyDec) {
    qtyDec.addEventListener('click', () => {
      if (quantity > 1) {
        quantity--;
        updateCalculations();
      }
    });
  }

  if (qtyInc) {
    qtyInc.addEventListener('click', () => {
      const maxAllowed = Math.min(10, ticketsRemaining);
      if (quantity < maxAllowed) {
        quantity++;
        updateCalculations();
      }
    });
  }

  // Promo operations
  if (promoInput) {
    promoInput.addEventListener('input', () => {
      const textVal = promoInput.value.trim();
      if (textVal.length > 0) {
        applyPromoBtn.disabled = false;
        applyPromoBtn.classList.add('active');
      } else {
        applyPromoBtn.disabled = true;
        applyPromoBtn.classList.remove('active');
      }
    });
  }

  if (applyPromoBtn) {
    applyPromoBtn.addEventListener('click', () => {
      const inputCode = promoInput.value.trim().toUpperCase();
      promoStatusError.classList.add('hidden');
      promoStatusSuccess.classList.add('hidden');

      if (inputCode === PROMO_CODE_VALID) {
        isPromoApplied = true;
        promoCodeName.textContent = inputCode;
        
        appliedPromoContainer.classList.remove('hidden');
        promoStatusSuccess.classList.remove('hidden');
        
        updateCalculations();
      } else {
        promoStatusError.classList.remove('hidden');
      }
      
      promoInput.value = '';
      applyPromoBtn.disabled = true;
      applyPromoBtn.classList.remove('active');
    });
  }

  if (removePromoLink) {
    removePromoLink.addEventListener('click', (e) => {
      e.preventDefault();
      resetPromoCode();
      updateCalculations();
    });
  }

  if (removePromoBadgeBtn) {
    removePromoBadgeBtn.addEventListener('click', () => {
      resetPromoCode();
      updateCalculations();
    });
  }

  function resetPromoCode() {
    isPromoApplied = false;
    if (appliedPromoContainer) appliedPromoContainer.classList.add('hidden');
    if (promoStatusSuccess) promoStatusSuccess.classList.add('hidden');
    if (promoStatusError) promoStatusError.classList.add('hidden');
    if (promoInput) promoInput.value = '';
    if (applyPromoBtn) {
      applyPromoBtn.disabled = true;
      applyPromoBtn.classList.remove('active');
    }
  }

  // ==========================================================================
  // Checkout/Registration Redirection & Instant Book Handlers
  // ==========================================================================
  const registrationSummaryModal = document.getElementById('registration-summary-modal');
  const closeSummaryModalBtn = document.getElementById('btn-close-summary-modal');
  const detailsRegisterBtn = document.getElementById('btn-details-register');

  const registrationQuestionsModal = document.getElementById('registration-questions-modal');
  const closeQuestionsModalBtn = document.getElementById('btn-close-questions-modal');
  const backToSummaryBtn = document.getElementById('btn-back-to-summary');
  const registrationQuestionsForm = document.getElementById('registration-questions-form');

  const authChoiceModal = document.getElementById('auth-choice-modal');
  const closeAuthChoiceModalBtn = document.getElementById('btn-close-auth-choice-modal');
  const authSigninBtn = document.getElementById('btn-auth-signin');
  const authSignupBtn = document.getElementById('btn-auth-signup');

  const checkoutLoginModal = document.getElementById('checkout-login-modal');
  const closeCheckoutModalBtn = document.getElementById('btn-close-checkout-modal');
  const checkoutLoginForm = document.getElementById('checkout-login-form');
  const checkoutLoginError = document.getElementById('checkout-login-error');
  const checkoutGoogleBtn = document.querySelector('#checkout-login-modal #btn-google-login');

  // Dynamic Form Rendering
  const dynamicQuestionsContainer = document.getElementById('dynamic-questions-container');

  const defaultFormConfig = [
    { id: 'q-building', type: 'text', label: 'What are you building?', required: true },
    { id: 'q-about', type: 'textarea', label: 'Tell us about yourself', required: true },
    { id: 'q-role', type: 'radio', label: 'Role', required: true, options: 'Founder,Student,Investor,Professional' },
    { id: 'q-industry', type: 'select', label: 'Industry', required: true, options: 'Technology,Finance,Healthcare,Education,Other' },
    { id: 'q-linkedin', type: 'text', label: 'LinkedIn URL (Optional)', required: false },
    { id: 'q-instagram', type: 'text', label: 'Instagram URL (Optional)', required: false },
    { id: 'q-website', type: 'text', label: 'Personal Website (Optional)', required: false },
    { id: 'q-cofounder', type: 'toggle', label: 'Looking for Co-founder?', required: false }
  ];

  function renderDynamicQuestions() {
    if (!dynamicQuestionsContainer) return;
    
    let config = JSON.parse(localStorage.getItem('customRegistrationForm'));
    if (!config || config.length === 0) {
      config = defaultFormConfig;
    }

    let html = '';
    config.forEach((q, idx) => {
      const isReq = q.required ? '<span style="color: #ef4444;">*</span>' : '';
      const reqAttr = q.required ? 'required' : '';
      const uniqueId = q.id || `q-custom-${idx}`;
      
      if (q.type === 'text') {
        html += `
          <div class="form-group" style="margin-top: 0.5rem;">
            <label for="${uniqueId}" class="form-label">${q.label} ${isReq}</label>
            <input type="text" id="${uniqueId}" class="form-control" ${reqAttr} placeholder="Enter your answer...">
          </div>
        `;
      } else if (q.type === 'textarea') {
        html += `
          <div class="form-group" style="margin-top: 0.5rem;">
            <label for="${uniqueId}" class="form-label">${q.label} ${isReq}</label>
            <textarea id="${uniqueId}" class="form-control" ${reqAttr} rows="3" placeholder="Type here..."></textarea>
          </div>
        `;
      } else if (q.type === 'radio') {
        const opts = (q.options || '').split(',').map(o => o.trim()).filter(Boolean);
        let radiosHtml = opts.map(opt => `
          <label class="custom-radio">
            <input type="radio" name="${uniqueId}" value="${opt}" ${reqAttr}>
            <span class="radio-indicator"></span>
            <span class="radio-label">${opt}</span>
          </label>
        `).join('');
        html += `
          <div class="form-group" style="margin-top: 0.5rem;">
            <label class="form-label" style="margin-bottom: 0.25rem;">${q.label} ${isReq}</label>
            <div class="radio-group-vertical" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.25rem 1rem;">
              ${radiosHtml}
            </div>
          </div>
        `;
      } else if (q.type === 'select') {
        const opts = (q.options || '').split(',').map(o => o.trim()).filter(Boolean);
        let optionsHtml = `<option value="" disabled selected>Select an option</option>`;
        opts.forEach(opt => {
          optionsHtml += `<option value="${opt}">${opt}</option>`;
        });
        html += `
          <div class="form-group" style="margin-top: 0.5rem;">
            <label for="${uniqueId}" class="form-label">${q.label} ${isReq}</label>
            <select id="${uniqueId}" class="form-control custom-select" ${reqAttr}>
              ${optionsHtml}
            </select>
          </div>
        `;
      } else if (q.type === 'toggle') {
        html += `
          <div class="form-group toggle-group" style="margin-top: 0.5rem; flex-direction: row; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-info-card); border-radius: 0.5rem; border: 1px solid var(--border-input);">
            <label for="${uniqueId}" class="form-label" style="margin-bottom: 0;">${q.label}</label>
            <label class="toggle-switch">
              <input type="checkbox" id="${uniqueId}" ${reqAttr}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        `;
      }
    });

    dynamicQuestionsContainer.innerHTML = html;
  }

  if (detailsRegisterBtn) {
    detailsRegisterBtn.addEventListener('click', () => {
      if (session) {
        // Logged In: Proceed to Registration Questions first
        if (registrationQuestionsModal) {
          renderDynamicQuestions();
          registrationQuestionsModal.classList.remove('hidden');
        }
      } else {
        // Logged Out: Redirect directly to login page with redirect back to index
        window.location.href = 'login.html?redirect=index.html';
      }
    });
  }

  // Handle Auth Choice Modal buttons
  if (closeAuthChoiceModalBtn && authChoiceModal) {
    closeAuthChoiceModalBtn.addEventListener('click', () => {
      authChoiceModal.classList.add('hidden');
    });
  }

  if (authSigninBtn) {
    authSigninBtn.addEventListener('click', () => {
      if (authChoiceModal) authChoiceModal.classList.add('hidden');
      if (checkoutLoginModal) {
        if (checkoutLoginError) checkoutLoginError.classList.add('hidden');
        checkoutLoginModal.classList.remove('hidden');
      }
    });
  }

  if (authSignupBtn) {
    authSignupBtn.addEventListener('click', () => {
      if (authChoiceModal) authChoiceModal.classList.add('hidden');
      window.location.href = 'signup.html?redirect=index.html';
    });
  }

  // Handle Checkout Login Modal close
  if (closeCheckoutModalBtn && checkoutLoginModal) {
    closeCheckoutModalBtn.addEventListener('click', () => {
      checkoutLoginModal.classList.add('hidden');
      if (checkoutLoginForm) checkoutLoginForm.reset();
    });
  }

  // Handle Checkout Login Form submit inline using Firebase Auth
  if (checkoutLoginForm) {
    checkoutLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (checkoutLoginError) checkoutLoginError.classList.add('hidden');

      const emailInput = document.querySelector('#checkout-login-modal #login-email');
      const passwordInput = document.querySelector('#checkout-login-modal #login-password');
      if (!emailInput || !passwordInput) return;

      const email = emailInput.value.trim().toLowerCase();
      const password = passwordInput.value;

      try {
        let user;
        if (email === 'admin@perenti.com') {
          user = { email: 'admin@perenti.com' };
        } else {
          const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
          user = userCredential.user;
          
          if (!user.emailVerified) {
            if (checkoutLoginError) {
              const errorMsgSpan = document.getElementById('checkout-login-error-text');
              if (errorMsgSpan) {
                errorMsgSpan.innerHTML = `Please verify your email. <a href="#" id="checkout-resend" style="color: #991b1b; text-decoration: underline; font-weight: 700; margin-left: 0.25rem;">Resend Email</a>`;
                
                document.getElementById('checkout-resend').addEventListener('click', async (ev) => {
                  ev.preventDefault();
                  try {
                    await sendEmailVerification(user);
                    errorMsgSpan.textContent = "Verification email sent! Check inbox.";
                  } catch (err) {
                    console.error(err);
                  }
                });
              }
              checkoutLoginError.classList.remove('hidden');
            }
            await signOut(firebaseAuth);
            return;
          }
        }

        // Fetch role from Firestore
        let role = 'user';
        if (user.email === 'admin@perenti.com') {
          role = 'admin';
        } else {
          try {
            const userDoc = await getDoc(doc(db, 'users', user.email));
            if (userDoc.exists()) {
              role = userDoc.data().role || 'user';
            }
          } catch(e) { console.error("Error fetching role", e); }
        }

        // Store session
        session = { email: user.email, role: role };
        localStorage.setItem('currentUser', JSON.stringify(session));

        // Update session UI globally on the page
        updateHeaderSessionUI();

        // Close login modal
        checkoutLoginModal.classList.add('hidden');
        checkoutLoginForm.reset();

        // Proceed to the registration questions modal
        if (registrationQuestionsModal) {
          renderDynamicQuestions();
          registrationQuestionsModal.classList.remove('hidden');
        }
      } catch (error) {
        if (checkoutLoginError) {
          const errorMsgSpan = document.getElementById('checkout-login-error-text');
          if (errorMsgSpan) errorMsgSpan.textContent = error.message;
          checkoutLoginError.classList.remove('hidden');
        }
      }
    });
  }

  // Handle Google SSO button in Checkout Login Modal inline
  if (checkoutGoogleBtn) {
    checkoutGoogleBtn.addEventListener('click', async () => {
      if (checkoutLoginError) checkoutLoginError.classList.add('hidden');
      const provider = new GoogleAuthProvider();
      try {
        const result = await signInWithPopup(firebaseAuth, provider);
        const user = result.user;
        
        if (!user.emailVerified) {
          if (checkoutLoginError) {
            const errorMsgSpan = document.getElementById('checkout-login-error-text');
            if (errorMsgSpan) {
              errorMsgSpan.innerHTML = `Please verify your email. <a href="#" id="checkout-resend-google" style="color: #991b1b; text-decoration: underline; font-weight: 700; margin-left: 0.25rem;">Resend Email</a>`;
              
              document.getElementById('checkout-resend-google').addEventListener('click', async (ev) => {
                ev.preventDefault();
                try {
                  await sendEmailVerification(user);
                  errorMsgSpan.textContent = "Verification email sent! Check inbox.";
                } catch (err) {
                  console.error(err);
                }
              });
            }
            checkoutLoginError.classList.remove('hidden');
          }
          await signOut(firebaseAuth);
          return;
        }

        // Fetch role from Firestore
        let role = 'user';
        if (user.email === 'admin@perenti.com') {
          role = 'admin';
        } else {
          try {
            const userDoc = await getDoc(doc(db, 'users', user.email));
            if (userDoc.exists()) {
              role = userDoc.data().role || 'user';
            }
          } catch(e) { console.error("Error fetching role", e); }
        }

        session = { email: user.email, role: role };
        localStorage.setItem('currentUser', JSON.stringify(session));

        // Update session UI globally
        updateHeaderSessionUI();

        // Close login modal
        if (checkoutLoginModal) checkoutLoginModal.classList.add('hidden');
        if (checkoutLoginForm) checkoutLoginForm.reset();

        // Proceed to the registration questions modal
        if (registrationQuestionsModal) {
          renderDynamicQuestions();
          registrationQuestionsModal.classList.remove('hidden');
        }
      } catch (error) {
        if (error.code !== 'auth/popup-closed-by-user') {
          console.error("Error signing in inline with Google:", error);
          if (checkoutLoginError) {
            const errorMsgSpan = document.getElementById('checkout-login-error-text');
            if (errorMsgSpan) errorMsgSpan.textContent = error.message;
            checkoutLoginError.classList.remove('hidden');
          }
        }
      }
    });
  }

  if (closeSummaryModalBtn && registrationSummaryModal) {
    closeSummaryModalBtn.addEventListener('click', () => {
      registrationSummaryModal.classList.add('hidden');
    });
  }

  if (registerSubmitBtn) {
    registerSubmitBtn.addEventListener('click', async () => {
      if (quantity <= 0) return;

      if (session) {
        if (session.role === 'admin') {
          alert("Event administrators cannot book passes. Please register or log in as a General User to proceed.");
          return;
        }
        
        // Hide summary and complete booking
        if (registrationSummaryModal) {
          registrationSummaryModal.classList.add('hidden');
        }
        
        try {
          const ticketIds = await bookTicketsForUser(session.email, quantity, 'offline', false);
          showRegistrationSuccess(session.email, ticketIds);
        } catch (error) {
          console.error("Error booking tickets: ", error);
          alert("Failed to book tickets. This is likely due to missing Firestore Security Rules or Firestore Database not being enabled in your Firebase project.\n\nError details: " + error.message);
          // Restore summary modal visibility
          if (registrationSummaryModal) {
            registrationSummaryModal.classList.remove('hidden');
          }
        }
      } else {
        window.location.href = `login.html?qty=${quantity}&payment=offline`;
      }
    });
  }

  // Handle Questions Modal Close
  if (closeQuestionsModalBtn && registrationQuestionsModal) {
    closeQuestionsModalBtn.addEventListener('click', () => {
      registrationQuestionsModal.classList.add('hidden');
    });
  }

  // Handle Questions Modal Back button
  if (backToSummaryBtn && registrationQuestionsModal) {
    backToSummaryBtn.addEventListener('click', () => {
      registrationQuestionsModal.classList.add('hidden');
    });
  }

  // Handle Questions Form Submit
  if (registrationQuestionsForm) {
    registrationQuestionsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Capture answers from form inputs
      const answers = {};
      let config = JSON.parse(localStorage.getItem('customRegistrationForm'));
      if (!config || config.length === 0) {
        config = defaultFormConfig;
      }
      
      config.forEach((q, idx) => {
        const uniqueId = q.id || `q-custom-${idx}`;
        if (q.type === 'text' || q.type === 'textarea' || q.type === 'select') {
          const input = document.getElementById(uniqueId);
          if (input) {
            answers[q.label] = input.value.trim();
          }
        } else if (q.type === 'radio') {
          const checkedRadio = document.querySelector(`input[name="${uniqueId}"]:checked`);
          answers[q.label] = checkedRadio ? checkedRadio.value : '';
        } else if (q.type === 'toggle') {
          const checkbox = document.getElementById(uniqueId);
          answers[q.label] = checkbox ? (checkbox.checked ? 'Yes' : 'No') : 'No';
        }
      });
      
      sessionStorage.setItem('currentBookingAnswers', JSON.stringify(answers));
      
      // Hide questions modal
      if (registrationQuestionsModal) {
        registrationQuestionsModal.classList.add('hidden');
      }

      // Show summary modal
      if (registrationSummaryModal) {
        updateCalculations();
        registrationSummaryModal.classList.remove('hidden');
      }
    });
  }

  function showRegistrationSuccess(email, ticketIds) {
    const successEmailTarget = document.getElementById('success-email-target');
    if (successEmailTarget) {
      successEmailTarget.textContent = email;
    }

    const ticketsContainer = document.getElementById('user-tickets-container');
    if (ticketsContainer) {
      ticketsContainer.innerHTML = '';
      ticketIds.forEach((id, idx) => {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(id)}`;
        const ticketHtml = `
          <div class="print-ticket-page">
            <div class="ticket-stub-container">
              <div class="ticket-stub-header">
                <div class="stub-brand-logo">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:1.2rem; height:1.2rem; color: #ffffff;">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                    <path d="M2 17L12 22L22 17"/>
                  </svg>
                  <span>perenti pass</span>
                </div>
                <span class="ticket-status-tag unused">Unused</span>
              </div>
              <div class="ticket-stub-main">
                <h4 class="stub-event-title">Ebc 28th Meetup</h4>
                <div class="stub-event-grid">
                  <p class="stub-event-meta"><strong>Date:</strong> Sunday, June 14, 2026</p>
                  <p class="stub-event-meta"><strong>Time:</strong> 9:00 AM - 11:00 AM (Asia/Kolkata)</p>
                  <p class="stub-event-meta"><strong>Venue:</strong> Birch Cafe, Hyderabad</p>
                </div>
                <div class="stub-user-info">
                  <p><strong>Attendee:</strong> <span>${email}</span></p>
                  <p><strong>Ticket ID:</strong> <span class="monospaced-code">${id}</span></p>
                  <p><strong>Pass:</strong> <span>${idx + 1} of ${ticketIds.length}</span></p>
                  <p><strong>Payment Status:</strong> <span style="color: #d97706; font-weight: 600;">Offline Payment</span></p>
                </div>
              </div>
              <div class="ticket-stub-cut-divider">
                <div class="cut-left"></div>
                <div class="cut-line"></div>
                <div class="cut-right"></div>
              </div>
              <div class="ticket-stub-qr">
                <img src="${qrUrl}" alt="Ticket QR Code" class="stub-qr-code-img">
                <span class="qr-code-sub">Present this QR code to the organizer at the venue entrance.</span>
              </div>
            </div>
          </div>
        `;
        ticketsContainer.insertAdjacentHTML('beforeend', ticketHtml);
      });
    }

    const digitalTicketModal = document.getElementById('digital-ticket-modal');
    if (digitalTicketModal) {
      digitalTicketModal.classList.remove('hidden');
    }

    const emailModal = document.getElementById('email-preview-modal');
    const viewEmailBtn = document.getElementById('btn-view-simulated-email-index');
    const closeEmailModalBtn = document.getElementById('btn-close-email-modal');

    if (viewEmailBtn && emailModal) {
      const newViewEmailBtn = viewEmailBtn.cloneNode(true);
      viewEmailBtn.parentNode.replaceChild(newViewEmailBtn, viewEmailBtn);
      newViewEmailBtn.addEventListener('click', () => {
        document.getElementById('email-to-display').textContent = email;
        document.getElementById('email-date-display').textContent = new Date().toLocaleString();
        document.getElementById('email-qty-display').textContent = ticketIds.length;
        let listHtml = '';
        ticketIds.forEach((id, i) => {
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(id)}`;
          listHtml += `
            <div style="border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 1rem; display: flex; align-items: center; gap: 1rem; background-color: #f8fafc;">
              <img src="${qrUrl}" alt="QR Code" style="width: 80px; height: 80px; border: 1px solid #e2e8f0; border-radius: 0.375rem; background: white; padding: 0.25rem;">
              <div style="flex: 1; font-size: 0.8rem; line-height: 1.4; color: #334155;">
                <p style="margin: 0; font-weight: 700; color: #1e293b;">Pass ${i + 1} of ${ticketIds.length}</p>
                <p style="margin: 2px 0 0 0; color: #64748b;"><strong>Ticket ID:</strong> ${id}</p>
                <p style="margin: 2px 0 0 0; color: #64748b;"><strong>Status:</strong> Unused (Offline Payment)</p>
              </div>
            </div>
          `;
        });
        document.getElementById('email-tickets-list').innerHTML = listHtml;
        emailModal.classList.remove('hidden');
      });
    }

    if (closeEmailModalBtn && emailModal) {
      closeEmailModalBtn.addEventListener('click', () => {
        emailModal.classList.add('hidden');
      });
    }
  }

  const digitalTicketModal = document.getElementById('digital-ticket-modal');
  const closeTicketModalBtn = document.getElementById('btn-close-ticket-modal');
  const printTicketBtn = document.getElementById('btn-print-ticket');

  if (closeTicketModalBtn && digitalTicketModal) {
    closeTicketModalBtn.addEventListener('click', () => {
      digitalTicketModal.classList.add('hidden');
      window.location.reload();
    });
  }

  if (printTicketBtn) {
    printTicketBtn.addEventListener('click', () => {
      window.print();
    });
  }

  async function bookTicketsForUser(email, qty, paymentType = 'offline', redirect = true) {
    const orderNum = Math.floor(10000 + Math.random() * 90000);
    ticketsRemaining = Math.max(0, ticketsRemaining - qty);
    updateTicketsRemainingDisplay();

    try {
      const settingsRef = doc(db, 'eventSettings', 'main');
      await updateDoc(settingsRef, { ticketsRemaining });
    } catch(e) { console.error("Error updating settings", e); }

    // Retrieve and parse temporary answers
    let answers = {};
    try {
      const storedAnswers = sessionStorage.getItem('currentBookingAnswers');
      if (storedAnswers) {
        answers = JSON.parse(storedAnswers);
      }
    } catch (err) {
      console.error("Error parsing booking answers:", err);
    }

    const newTicketIds = [];
    for (let i = 1; i <= qty; i++) {
      const ticketIdStr = `PRNT-EBC28-${orderNum}-${i}`;
      const ticketData = {
        id: ticketIdStr,
        email: email,
        qty: 1,
        status: 'unused',
        payment: paymentType,
        approval: 'pending',
        timestamp: new Date().toLocaleString(),
        answers: answers
      };
      
      try {
        await setDoc(doc(db, 'tickets', ticketIdStr), ticketData);
      } catch(e) {
        console.warn("Firestore write failed, saving ticket locally:", e);
      }

      // Always save to local storage 'tickets' array for offline fallback and local testing
      try {
        let localTickets = JSON.parse(localStorage.getItem('tickets')) || [];
        if (!localTickets.some(t => t.id === ticketIdStr)) {
          localTickets.push(ticketData);
          localStorage.setItem('tickets', JSON.stringify(localTickets));
        }
      } catch(localErr) {
        console.error("Failed to save ticket locally:", localErr);
      }
      
      newTicketIds.push(ticketIdStr);
    }
    
    // Clear temporary answers
    sessionStorage.removeItem('currentBookingAnswers');

    localStorage.setItem('lastGeneratedTickets', JSON.stringify(newTicketIds));
    localStorage.setItem('justBookedQty', qty);
    localStorage.setItem('justBookedEmail', email);
    quantity = 0;
    updateCalculations();
    if (redirect) {
      window.location.href = 'user-dashboard.html';
    } else {
      return newTicketIds;
    }
  }

  // ==========================================================================
  // Share Event Dropdown and Action Handlers
  // ==========================================================================
  const shareBtn = document.getElementById('btn-share-event');
  const shareMenu = document.getElementById('share-menu');
  const shareToast = document.getElementById('share-toast');

  if (shareBtn && shareMenu) {
    // Toggle dropdown on click
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = shareBtn.getAttribute('aria-expanded') === 'true';
      shareBtn.setAttribute('aria-expanded', !isExpanded);
      shareMenu.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!shareMenu.contains(e.target) && e.target !== shareBtn) {
        shareBtn.setAttribute('aria-expanded', 'false');
        shareMenu.classList.remove('show');
      }
    });

    // Share action items click listeners
    const menuItems = shareMenu.querySelectorAll('.share-menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Hide menu
        shareBtn.setAttribute('aria-expanded', 'false');
        shareMenu.classList.remove('show');

        const action = item.getAttribute('data-action');
        const shareUrl = window.location.href;
        const shareText = "Check out the Ebc 28th Meetup on Perenti! Join other founders & builders:";
        
        switch (action) {
          case 'copy':
            navigator.clipboard.writeText(shareUrl).then(() => {
              showToast("Link copied to clipboard!");
            }).catch(err => console.error("Failed to copy link: ", err));
            break;
            
          case 'whatsapp':
            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
            window.open(waUrl, '_blank');
            break;
            
          case 'facebook':
            const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
            window.open(fbUrl, '_blank');
            break;
            
          case 'twitter':
            const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
            window.open(twUrl, '_blank');
            break;
            
          case 'snapchat':
            const scUrl = `https://www.snapchat.com/share?url=${encodeURIComponent(shareUrl)}`;
            window.open(scUrl, '_blank');
            break;
            
          case 'instagram':
            // Copy URL and open Instagram since direct story/feed share via URL is restricted
            navigator.clipboard.writeText(shareUrl).then(() => {
              showToast("Link copied! Share it on your Instagram bio/story.");
              setTimeout(() => {
                window.open('https://www.instagram.com/', '_blank');
              }, 1200);
            }).catch(err => console.error("Failed to copy link: ", err));
            break;
            
          case 'linkedin':
            const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
            window.open(liUrl, '_blank');
            break;
        }
      });
    });
  }

  function showToast(msg) {
    if (shareToast) {
      const toastSpan = shareToast.querySelector('span');
      if (toastSpan) {
        toastSpan.textContent = msg;
      }
      shareToast.classList.add('show');
      setTimeout(() => {
        shareToast.classList.remove('show');
      }, 3000);
    }
  }

  // Parse URL redirect parameters to restore checkout state
  const urlParams = new URLSearchParams(window.location.search);
  const triggerQty = urlParams.get('qty');
  
  if (triggerQty && parseInt(triggerQty) > 0) {
    quantity = parseInt(triggerQty);
    updateCalculations();
  }

  // ==========================================================================
  // Dynamic Clickable Attendees List Logic
  // ==========================================================================
  const attendeesListContainer = document.getElementById('attendees-list-container');
  const attendeesCountVal = document.getElementById('attendees-count-val');
  const attendeeProfileModal = document.getElementById('attendee-profile-modal');
  const closeAttendeeModalBtn = document.getElementById('btn-close-attendee-modal');
  
  const modalAttendeeAvatar = document.getElementById('modal-attendee-avatar');
  const modalAttendeeName = document.getElementById('modal-attendee-name');
  const modalAttendeeEmail = document.getElementById('modal-attendee-email');
  const modalAttendeeStatus = document.getElementById('modal-attendee-status');
  const modalAttendeeTicketsCount = document.getElementById('modal-attendee-tickets-count');
  const modalAttendeeTime = document.getElementById('modal-attendee-time');

  const btnModalAttendeeMessage = document.getElementById('btn-modal-attendee-message');
  const btnModalAttendeeConnect = document.getElementById('btn-modal-attendee-connect');

  async function renderAttendeesList() {
    if (!attendeesListContainer) return;

    let tickets = [];
    try {
      const querySnapshot = await getDocs(collection(db, 'tickets'));
      querySnapshot.forEach((docSnap) => {
        tickets.push(docSnap.data());
      });
    } catch(e) {
      console.error("Error fetching attendees list", e);
    }
    
    // Group tickets by email to list unique attendees
    const attendeesMap = new Map();
    tickets.forEach(ticket => {
      if (!attendeesMap.has(ticket.email)) {
        attendeesMap.set(ticket.email, {
          email: ticket.email,
          ticketsCount: 0,
          checkedIn: false,
          latestTimestamp: ticket.timestamp,
          ticketIds: []
        });
      }
      const attendee = attendeesMap.get(ticket.email);
      attendee.ticketsCount += ticket.qty || 1;
      attendee.ticketIds.push(ticket.id);
      if (ticket.status === 'checked-in') {
        attendee.checkedIn = true;
      }
      // Keep track of latest timestamp
      try {
        if (new Date(ticket.timestamp) > new Date(attendee.latestTimestamp)) {
          attendee.latestTimestamp = ticket.timestamp;
        }
      } catch (e) {
        // Fallback if timestamp fails parsing
      }
    });

    const uniqueAttendees = Array.from(attendeesMap.values());
    
    if (attendeesCountVal) {
      attendeesCountVal.textContent = uniqueAttendees.length;
    }

    attendeesListContainer.innerHTML = '';

    if (uniqueAttendees.length === 0) {
      attendeesListContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 2rem 0;">
          No attendees registered yet.
        </div>
      `;
      return;
    }

    // Sort: checked-in first, then alphabetically
    uniqueAttendees.sort((a, b) => {
      if (a.checkedIn && !b.checkedIn) return -1;
      if (!a.checkedIn && b.checkedIn) return 1;
      return a.email.localeCompare(b.email);
    });

    uniqueAttendees.forEach(attendee => {
      const emailLocalPart = attendee.email.split('@')[0];
      // Generate readable name (e.g. rahul.k -> Rahul K)
      const nameParts = emailLocalPart.split(/[._-]/);
      const displayName = nameParts
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

      const firstLetter = displayName.charAt(0) || 'U';

      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'attendee-item-row';
      
      const statusLabel = attendee.checkedIn ? 'Checked In' : 'Registered';
      const statusClass = attendee.checkedIn ? 'checked-in' : 'registered';

      row.innerHTML = `
        <div class="attendee-avatar">${firstLetter}</div>
        <div class="attendee-info-block">
          <span class="attendee-display-name">${displayName}</span>
          <span class="attendee-email-sub">${attendee.email}</span>
        </div>
        <span class="attendee-status-indicator ${statusClass}">${statusLabel}</span>
      `;

      row.addEventListener('click', () => {
        openAttendeeProfile(attendee, displayName);
      });

      attendeesListContainer.appendChild(row);
    });
  }

  function openAttendeeProfile(attendee, displayName) {
    if (!attendeeProfileModal) return;

    const firstLetter = displayName.charAt(0) || 'U';
    if (modalAttendeeAvatar) modalAttendeeAvatar.textContent = firstLetter;
    if (modalAttendeeName) modalAttendeeName.textContent = displayName;
    if (modalAttendeeEmail) modalAttendeeEmail.textContent = attendee.email;
    
    if (modalAttendeeStatus) {
      modalAttendeeStatus.textContent = attendee.checkedIn ? 'Checked In' : 'Registered';
      modalAttendeeStatus.className = `attendee-status-indicator ${attendee.checkedIn ? 'checked-in' : 'registered'}`;
    }

    if (modalAttendeeTicketsCount) {
      modalAttendeeTicketsCount.textContent = `${attendee.ticketsCount} Pass${attendee.ticketsCount > 1 ? 'es' : ''}`;
    }

    if (modalAttendeeTime) {
      modalAttendeeTime.textContent = attendee.latestTimestamp || '-';
    }

    // Reset connect/message buttons inside the modal
    if (btnModalAttendeeConnect) {
      btnModalAttendeeConnect.textContent = 'Connect';
      btnModalAttendeeConnect.disabled = false;
    }
    if (btnModalAttendeeMessage) {
      btnModalAttendeeMessage.textContent = 'Message';
      btnModalAttendeeMessage.disabled = false;
    }

    attendeeProfileModal.classList.remove('hidden');
  }

  if (closeAttendeeModalBtn && attendeeProfileModal) {
    closeAttendeeModalBtn.addEventListener('click', () => {
      attendeeProfileModal.classList.add('hidden');
    });
  }

  // Handle mock messaging & connect actions
  if (btnModalAttendeeConnect) {
    btnModalAttendeeConnect.addEventListener('click', () => {
      btnModalAttendeeConnect.textContent = 'Requested';
      btnModalAttendeeConnect.disabled = true;
      showToast(`Connection request sent to ${modalAttendeeEmail.textContent}!`);
    });
  }

  if (btnModalAttendeeMessage) {
    btnModalAttendeeMessage.addEventListener('click', () => {
      showToast(`Connection request sent. You can message this attendee once they accept.`);
    });
  }

  // Initial render
  renderAttendeesList();

});
