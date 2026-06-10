document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // LocalStorage Database & Session Initialization
  // ==========================================================================
  
  // Seed default users if they don't exist
  if (!localStorage.getItem('users')) {
    const defaultUsers = [
      { email: 'nikhila@google.com', password: 'password', role: 'user' },
      { email: 'admin@perenti.com', password: 'password', role: 'admin' }
    ];
    localStorage.setItem('users', JSON.stringify(defaultUsers));
  }

  // Seed default tickets if they don't exist
  if (!localStorage.getItem('tickets')) {
    const defaultTickets = [
      { id: 'PRNT-EBC28-14205-1', email: 'rahul.k@gmail.com', qty: 1, status: 'unused', timestamp: '6/10/2026, 10:15:30 AM' },
      { id: 'PRNT-EBC28-14205-2', email: 'rahul.k@gmail.com', qty: 1, status: 'unused', timestamp: '6/10/2026, 10:15:30 AM' },
      { id: 'PRNT-EBC28-98421-1', email: 'sneha.dev@outlook.com', qty: 1, status: 'unused', timestamp: '6/10/2026, 11:22:45 AM' },
      { id: 'PRNT-EBC28-30581-1', email: 'v-priya@microsoft.com', qty: 1, status: 'checked-in', timestamp: '6/10/2026, 2:40:12 PM' }
    ];
    localStorage.setItem('tickets', JSON.stringify(defaultTickets));
  }

  // Initial capacity
  if (!localStorage.getItem('ticketsRemaining') || localStorage.getItem('ticketsRemaining') === '56') {
    localStorage.setItem('ticketsRemaining', '60');
  }

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
  // Horizontal Tab Switcher
  // ==========================================================================
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  const contentPanels = document.querySelectorAll('.content-panel');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPanelId = btn.getAttribute('data-panel');

      tabButtons.forEach(b => b.classList.remove('active'));
      contentPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(targetPanelId).classList.add('active');
    });
  });

  const registerShortcutBtn = document.getElementById('btn-switch-to-tickets');
  if (registerShortcutBtn) {
    registerShortcutBtn.addEventListener('click', () => {
      document.getElementById('btn-tab-tickets').click();
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
  const checkoutSubmitBtn = document.getElementById('btn-checkout-submit');

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

  let quantity = 0;
  let isPromoApplied = false;
  const PROMO_CODE_VALID = 'EBC10';
  const PROMO_DISCOUNT_PERCENT = 0.10; 

  // Read stock capacity from localstorage
  let ticketsRemaining = parseInt(localStorage.getItem('ticketsRemaining')) || 60;

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
    qtyDisplay.textContent = quantity;
    qtyDec.disabled = quantity <= 0;

    const maxAllowed = Math.min(10, ticketsRemaining);
    if (qtyInc) {
      qtyInc.disabled = quantity >= maxAllowed;
    }

    if (quantity > 0) {
      summaryEmptyView.classList.add('hidden');
      summaryBreakdownView.classList.remove('hidden');
      checkoutSubmitBtn.disabled = false;
      checkoutSubmitBtn.classList.add('active');
    } else {
      summaryEmptyView.classList.remove('hidden');
      summaryBreakdownView.classList.add('hidden');
      checkoutSubmitBtn.disabled = true;
      checkoutSubmitBtn.classList.remove('active');
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
      if (quantity > 0) {
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
  // Checkout Redirection & Instant Book Handlers
  // ==========================================================================
  if (checkoutSubmitBtn) {
    checkoutSubmitBtn.addEventListener('click', () => {
      if (quantity <= 0) return;

      if (session) {
        if (session.role === 'admin') {
          alert("Event administrators cannot book passes. Please register or log in as a General User to proceed.");
          return;
        }
        
        // Logged-in general user: book immediately
        bookTicketsForUser(session.email, quantity);
      } else {
        // Guest: redirect to login
        window.location.href = `login.html?qty=${quantity}`;
      }
    });
  }

  function bookTicketsForUser(email, qty) {
    const tickets = JSON.parse(localStorage.getItem('tickets')) || [];
    const orderNum = Math.floor(10000 + Math.random() * 90000);
    
    // Deduct stock
    ticketsRemaining = Math.max(0, ticketsRemaining - qty);
    localStorage.setItem('ticketsRemaining', ticketsRemaining);
    updateTicketsRemainingDisplay();

    const newTicketIds = [];
    for (let i = 1; i <= qty; i++) {
      const ticketIdStr = `PRNT-EBC28-${orderNum}-${i}`;
      tickets.push({
        id: ticketIdStr,
        email: email,
        qty: 1,
        status: 'unused',
        timestamp: new Date().toLocaleString()
      });
      newTicketIds.push(ticketIdStr);
    }

    localStorage.setItem('tickets', JSON.stringify(tickets));
    localStorage.setItem('lastGeneratedTickets', JSON.stringify(newTicketIds));

    // Reset stepper
    quantity = 0;
    updateCalculations();

    // Redirect to User Hub
    window.location.href = 'user-dashboard.html';
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

});
