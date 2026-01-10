// Variabili globali
let currentUser = null;
let adminCalendar = null;
let selectedDate = new Date();
let adminCalendarUnsubscribe = null;
let adminDayBookingsUnsubscribe = null;
let adminStatsUnsubscribe = null;
let allBookingsUnsubscribe = null;
let operatorsUnsubscribe = null;
let currentFilters = {
    operator: '',
    service: '',
    status: '',
    startDate: '',
    endDate: ''
};

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initCalendar();
    initModals();
    initEventListeners();
    initTabs();
    loadAdminData();
    
    // Verifica stato abbonamento dopo redirect da Stripe
    if (typeof verifySubscriptionStatus === 'function') {
        verifySubscriptionStatus();
    }
    
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            loadAdminData();
            loadOperators();
        } else {
            currentUser = null;
            // Disconnetti i listener quando l'utente esce
            if (adminCalendarUnsubscribe) {
                adminCalendarUnsubscribe();
                adminCalendarUnsubscribe = null;
            }
            if (adminDayBookingsUnsubscribe) {
                adminDayBookingsUnsubscribe();
                adminDayBookingsUnsubscribe = null;
            }
            if (adminStatsUnsubscribe) {
                adminStatsUnsubscribe();
                adminStatsUnsubscribe = null;
            }
            if (allBookingsUnsubscribe) {
                allBookingsUnsubscribe();
                allBookingsUnsubscribe = null;
            }
            if (operatorsUnsubscribe) {
                operatorsUnsubscribe();
                operatorsUnsubscribe = null;
            }
            // Reindirizza al login se non autenticato
            window.location.href = 'index.html';
        }
    });
});

// Autenticazione
function initAuth() {
    const logoutBtn = document.getElementById('logoutBtn');
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    const menuDropdown = document.getElementById('menuDropdown');
    const menuSettings = document.getElementById('menuSettings');
    
    // Menu toggle
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.classList.toggle('show');
        });
    }
    
    // Chiudi menu quando si clicca fuori
    document.addEventListener('click', (e) => {
        if (menuDropdown && !menuDropdown.contains(e.target) && !menuToggleBtn.contains(e.target)) {
            menuDropdown.classList.remove('show');
        }
    });
    
    // Menu items
    if (menuSettings) {
        menuSettings.addEventListener('click', (e) => {
            e.preventDefault();
            menuDropdown.classList.remove('show');
            // Attiva tab impostazioni
            const settingsTab = document.querySelector('.tab-btn[data-tab="settings"]');
            if (settingsTab) {
                settingsTab.click();
            }
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                window.location.href = 'index.html';
            } catch (error) {
                alert('Errore durante il logout: ' + error.message);
            }
        });
    }
}

// Calendario Admin
function initCalendar() {
    const calendarEl = document.getElementById('adminCalendar');
    
    if (!calendarEl) {
        console.error('Elemento calendario non trovato');
        return;
    }
    
    // Se il calendario esiste già, distruggilo prima di ricrearlo
    if (adminCalendar) {
        adminCalendar.destroy();
    }
    
    adminCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridDay',
        locale: 'it',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        height: 'auto',
        events: [],
        eventClick: (info) => {
            showBookingDetail(info.event.id);
        },
        dateClick: (info) => {
            selectedDate = info.date;
            loadDayBookings();
        },
        eventDisplay: 'block',
        dayMaxEvents: true
    });

    // Renderizza solo se l'elemento è visibile
    const calendarTab = document.getElementById('calendarTab');
    if (calendarTab && calendarTab.classList.contains('active')) {
        // Aspetta un po' per assicurarsi che l'elemento sia completamente visibile
        setTimeout(() => {
            adminCalendar.render();
            adminCalendar.updateSize();
            loadCalendarEvents();
        }, 100);
    }
}

// Modali
function initModals() {
    const modals = document.querySelectorAll('.modal');
    const closeBtns = document.querySelectorAll('.close');

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('show');
        });
    });

    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
}

// Tab Navigation
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // Rimuovi active da tutti
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Se si apre la tab settings, assicurati che il link sia generato
            if (targetTab === 'settings' && currentUser) {
                setTimeout(() => {
                    const linkInput = document.getElementById('bookingLink');
                    if (linkInput && (!linkInput.value || linkInput.value.trim() === '')) {
                        loadBookingLink();
                    }
                }, 100);
            }
            
            // Aggiungi active al selezionato
            btn.classList.add('active');
            const targetTabContent = document.getElementById(targetTab + 'Tab');
            if (targetTabContent) {
                targetTabContent.classList.add('active');
            }
            
            // Inizializza calendario se necessario
            if (targetTab === 'calendar') {
                // Aspetta che il tab sia visibile prima di inizializzare/aggiornare il calendario
                setTimeout(() => {
                    const calendarEl = document.getElementById('adminCalendar');
                    if (calendarEl) {
                        if (adminCalendar) {
                            // Se il calendario esiste già, aggiorna la vista
                            adminCalendar.render();
                            adminCalendar.updateSize();
                            // Ricarica gli eventi
                            loadCalendarEvents();
                        } else {
                            // Altrimenti inizializzalo
                            initCalendar();
                        }
                    } else {
                        console.error('Elemento calendario non trovato nel tab calendar');
                    }
                }, 200);
            }
            
            // Carica dati specifici per tab
            if (targetTab === 'bookings') {
                loadAllBookings();
            } else if (targetTab === 'reports') {
                // Carica dati e grafici quando si apre la tab Reports
                // Assicurati che il contenuto sia visibile
                const advancedContent = document.getElementById('advancedAnalyticsContent');
                if (advancedContent) {
                    advancedContent.classList.add('active');
                }
                setTimeout(() => {
                    loadReportData();
                }, 200);
            } else if (targetTab === 'settings') {
                loadSettings();
            }
        });
    });
}

// Event Listeners
function initEventListeners() {
    const selectedDateInput = document.getElementById('selectedDate');
    const todayBtn = document.getElementById('todayBtn');
    
    selectedDateInput.addEventListener('change', (e) => {
        selectedDate = new Date(e.target.value);
        if (adminCalendar) {
            adminCalendar.gotoDate(selectedDate);
        }
        loadDayBookings();
    });

    todayBtn.addEventListener('click', () => {
        selectedDate = new Date();
        selectedDateInput.value = selectedDate.toISOString().split('T')[0];
        if (adminCalendar) {
            adminCalendar.gotoDate(selectedDate);
        }
        loadDayBookings();
    });

    // Imposta data di oggi
    selectedDateInput.value = new Date().toISOString().split('T')[0];

    // Azioni prenotazione
    document.getElementById('completeBookingBtn').addEventListener('click', () => {
        markBookingCompleted();
    });

    document.getElementById('editBookingBtn').addEventListener('click', () => {
        editBooking();
    });

    document.getElementById('deleteBookingBtn').addEventListener('click', () => {
        deleteBooking();
    });

    // Filtri calendario
    document.getElementById('filterOperator')?.addEventListener('change', (e) => {
        currentFilters.operator = e.target.value;
        loadCalendarEvents();
    });

    document.getElementById('filterService')?.addEventListener('change', (e) => {
        currentFilters.service = e.target.value;
        loadCalendarEvents();
    });

    document.getElementById('filterStatus')?.addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        loadCalendarEvents();
    });

    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
        currentFilters.operator = '';
        currentFilters.service = '';
        currentFilters.status = '';
        document.getElementById('filterOperator').value = '';
        document.getElementById('filterService').value = '';
        document.getElementById('filterStatus').value = '';
        loadCalendarEvents();
    });

    // Filtri prenotazioni
    document.getElementById('applyFiltersBtn')?.addEventListener('click', () => {
        currentFilters.startDate = document.getElementById('filterStartDate').value;
        currentFilters.endDate = document.getElementById('filterEndDate').value;
        currentFilters.operator = document.getElementById('filterBookingOperator').value;
        currentFilters.service = document.getElementById('filterBookingService').value;
        loadAllBookings();
    });

    // Operatori
    document.getElementById('addOperatorBtn')?.addEventListener('click', () => {
        document.getElementById('operatorModal').classList.add('show');
    });

    // Icona informativa operatori
    document.getElementById('operatorsInfoIcon')?.addEventListener('click', () => {
        document.getElementById('operatorsInfoModal').classList.add('show');
    });

    document.getElementById('operatorForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveOperator();
    });

    // Prenotazioni
    document.getElementById('addBookingBtn')?.addEventListener('click', () => {
        openAddBookingModal();
    });

    document.getElementById('addBookingForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await createAdminBooking();
    });

    // Reports
    document.getElementById('reportPeriod')?.addEventListener('change', (e) => {
        const customPeriod = document.getElementById('customPeriod');
        if (e.target.value === 'custom') {
            customPeriod.style.display = 'flex';
        } else {
            customPeriod.style.display = 'none';
        }
    });

    document.getElementById('generateReportBtn')?.addEventListener('click', () => {
        generateReport();
    });
    
    // Mostra/nascondi periodo personalizzato e aggiorna i grafici
    document.getElementById('reportPeriod')?.addEventListener('change', (e) => {
        const customPeriod = document.getElementById('customPeriod');
        if (customPeriod) {
            customPeriod.style.display = e.target.value === 'custom' ? 'block' : 'none';
        }
        // Aggiorna i grafici quando cambia il periodo del report
        loadReportData();
    });
    
    // Aggiorna i grafici quando cambiano le date personalizzate del report
    document.getElementById('reportStartDate')?.addEventListener('change', () => {
        const period = document.getElementById('reportPeriod').value;
        if (period === 'custom') {
            const startDate = document.getElementById('reportStartDate').value;
            const endDate = document.getElementById('reportEndDate').value;
            if (startDate && endDate) {
                loadReportData();
            }
        }
    });
    
    document.getElementById('reportEndDate')?.addEventListener('change', () => {
        const period = document.getElementById('reportPeriod').value;
        if (period === 'custom') {
            const startDate = document.getElementById('reportStartDate').value;
            const endDate = document.getElementById('reportEndDate').value;
            if (startDate && endDate) {
                loadReportData();
            }
        }
    });

    // Carica analytics quando si apre la tab Reports
    // (gestito in initTabs quando si clicca sulla tab reports)

    // Analytics Period
    document.getElementById('analyticsPeriod')?.addEventListener('change', (e) => {
        const customPeriod = document.getElementById('analyticsCustomPeriod');
        if (customPeriod) {
            customPeriod.style.display = e.target.value === 'custom' ? 'flex' : 'none';
        }
        // Aggiorna automaticamente i grafici se il tab advanced è attivo
        const advancedContent = document.getElementById('advancedAnalyticsContent');
        if (advancedContent && advancedContent.classList.contains('active')) {
            loadAdvancedAnalytics();
        }
    });

    // Analytics Custom Dates - aggiorna quando cambiano le date
    document.getElementById('analyticsStartDate')?.addEventListener('change', () => {
        const advancedContent = document.getElementById('advancedAnalyticsContent');
        if (advancedContent && advancedContent.classList.contains('active')) {
            const period = document.getElementById('analyticsPeriod').value;
            if (period === 'custom') {
                const startDate = document.getElementById('analyticsStartDate').value;
                const endDate = document.getElementById('analyticsEndDate').value;
                if (startDate && endDate) {
                    loadAdvancedAnalytics();
                }
            }
        }
    });

    document.getElementById('analyticsEndDate')?.addEventListener('change', () => {
        const advancedContent = document.getElementById('advancedAnalyticsContent');
        if (advancedContent && advancedContent.classList.contains('active')) {
            const period = document.getElementById('analyticsPeriod').value;
            if (period === 'custom') {
                const startDate = document.getElementById('analyticsStartDate').value;
                const endDate = document.getElementById('analyticsEndDate').value;
                if (startDate && endDate) {
                    loadAdvancedAnalytics();
                }
            }
        }
    });

    // Export
    document.getElementById('exportDataBtn')?.addEventListener('click', () => {
        exportData();
    });

    // Settings
    document.getElementById('companyProfileForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveCompanyProfile();
    });

    document.getElementById('changePasswordBtn')?.addEventListener('click', async () => {
        await changePassword();
    });

    // Password strength checker
    const newPasswordInput = document.getElementById('newPassword');
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', (e) => {
            checkPasswordStrength(e.target.value);
        });
    }

    // Clear password strength when password is cleared
    const confirmPasswordInput = document.getElementById('confirmPassword');
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', () => {
            const newPassword = document.getElementById('newPassword').value;
            if (!newPassword) {
                hidePasswordStrength();
            }
        });
    }

    document.getElementById('upgradePlanBtn')?.addEventListener('click', () => {
        document.querySelector('.plans-grid')?.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('manageBillingBtn')?.addEventListener('click', () => {
        alert('Funzionalità di gestione fatturazione in arrivo. Per ora, contatta il supporto per modifiche al piano.');
    });

    // Booking Link
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const testLinkBtn = document.getElementById('testLinkBtn');
    const shareLinkBtn = document.getElementById('shareLinkBtn');
    const whatsappShareBtn = document.getElementById('whatsappShareBtn');
    const downloadQRBtn = document.getElementById('downloadQRBtn');
    
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            copyBookingLink();
        });
    }
    
    if (testLinkBtn) {
        testLinkBtn.addEventListener('click', () => {
            testBookingLink();
        });
    }
    
    if (shareLinkBtn) {
        shareLinkBtn.addEventListener('click', () => {
            shareBookingLink();
        });
    }
    
    if (whatsappShareBtn) {
        whatsappShareBtn.addEventListener('click', () => {
            shareViaWhatsApp();
        });
    }
    
    if (downloadQRBtn) {
        downloadQRBtn.addEventListener('click', () => {
            downloadQRCode();
        });
    }

    document.querySelectorAll('.plan-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const plan = e.target.dataset.plan;
            handlePlanChange(plan);
        });
    });

    document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
        if (confirm('Sei sicuro di voler eliminare il tuo account? Questa azione è irreversibile e eliminerà tutti i dati.')) {
            if (confirm('ULTIMA CONFERMA: Eliminare definitivamente l\'account?')) {
                await deleteAccount();
            }
        }
    });
}

// Caricamento dati admin
async function loadAdminData() {
    if (!currentUser) return;
    
    // Carica eventi calendario solo se il calendario è inizializzato
    // Se non è inizializzato, verrà caricato quando si apre il tab calendar
    if (adminCalendar) {
        loadCalendarEvents();
    }
    
    loadDayBookings();
    loadStats();
    loadAdvancedStats();
}

// Carica eventi calendario con sincronizzazione in tempo reale e filtri
function loadCalendarEvents() {
    // Disconnetti il listener precedente se esiste
    if (adminCalendarUnsubscribe) {
        adminCalendarUnsubscribe();
        adminCalendarUnsubscribe = null;
    }

    if (!adminCalendar) {
        console.warn('loadCalendarEvents: calendario non inizializzato');
        return;
    }

    try {
        if (!currentUser) {
            console.log('loadCalendarEvents: utente non autenticato');
            return;
        }
        
        console.log('loadCalendarEvents: caricamento eventi per companyId:', currentUser.uid);
        
        // Usa una query semplice che carica tutte le prenotazioni e filtra lato client
        // Questo evita problemi con indici composti mancanti
        let query = db.collection('bookings');
        
        // Applica solo il filtro status se presente (più semplice)
        if (currentFilters.status) {
            query = query.where('status', '==', currentFilters.status);
        } else {
            // Carica tutte le prenotazioni e filtriamo lato client per status
            query = query.where('status', 'in', ['pending', 'confirmed', 'cancelled']);
        }
        
        // Sincronizzazione in tempo reale
        adminCalendarUnsubscribe = query
            .orderBy('dateTime', 'asc')
            .onSnapshot((snapshot) => {
                console.log('loadCalendarEvents: ricevute', snapshot.size, 'prenotazioni totali dal database');
                const events = [];
                let skippedCount = 0;
                
                snapshot.forEach(doc => {
                    const booking = doc.data();
                    
                    // Filtra per companyId lato client
                    // Se ha companyId, deve corrispondere all'azienda corrente
                    if (booking.companyId) {
                        if (booking.companyId !== currentUser.uid) {
                            skippedCount++;
                            return; // Salta prenotazioni di altre aziende
                        }
                    } else {
                        // Se non ha companyId, potrebbe essere una prenotazione vecchia
                        // Per sicurezza, la includiamo solo se non ha companyId (retrocompatibilità)
                        console.log('Prenotazione senza companyId trovata:', doc.id, booking);
                    }
                    
                    // Filtro status lato client (se non già filtrato)
                    if (!currentFilters.status) {
                        if (!['pending', 'confirmed'].includes(booking.status)) {
                            skippedCount++;
                            return;
                        }
                    }
                    
                    // Filtro servizio lato client
                    if (currentFilters.service && booking.service !== currentFilters.service) {
                        skippedCount++;
                        return;
                    }
                    
                    // Filtro operatore lato client
                    if (currentFilters.operator && booking.operatorId !== currentFilters.operator) {
                        skippedCount++;
                        return;
                    }
                    
                    // Verifica che dateTime esista e sia valido
                    if (!booking.dateTime) {
                        console.warn('Prenotazione senza dateTime:', doc.id);
                        skippedCount++;
                        return;
                    }
                    
                    const date = timestampToDate(booking.dateTime);
                    if (!date || isNaN(date.getTime())) {
                        console.warn('Data non valida per prenotazione:', doc.id, booking.dateTime);
                        skippedCount++;
                        return;
                    }
                    
                    // Verifica che animalName esista
                    if (!booking.animalName) {
                        console.warn('Prenotazione senza animalName:', doc.id);
                    }
                    
                    let color = '#f39c12'; // pending
                    if (booking.status === 'confirmed') {
                        color = '#4a90e2';
                    } else if (booking.status === 'cancelled') {
                        color = '#e74c3c';
                    }
                    
                    // Crea titolo evento
                    const serviceNames = {
                        'toelettatura-completa': 'Toelettatura',
                        'bagno': 'Bagno',
                        'taglio-unghie': 'Taglio Unghie',
                        'pulizia-orecchie': 'Pulizia Orecchie',
                        'taglio-pelo': 'Taglio Pelo'
                    };
                    const serviceName = serviceNames[booking.service] || booking.service || 'Servizio';
                    const title = `${booking.animalName || 'N/A'} - ${serviceName}`;
                    
                    events.push({
                        id: doc.id,
                        title: title,
                        start: date.toISOString(),
                        backgroundColor: color,
                        extendedProps: {
                            booking: { id: doc.id, ...booking }
                        }
                    });
                });

                console.log('loadCalendarEvents: filtrate', skippedCount, 'prenotazioni, aggiungendo', events.length, 'eventi al calendario');
                
                // Rimuovi tutti gli eventi esistenti
                try {
                    adminCalendar.removeAllEvents();
                } catch (removeError) {
                    console.warn('Errore nella rimozione eventi:', removeError);
                }
                
                // Aggiungi i nuovi eventi
                if (events.length > 0) {
                    console.log('loadCalendarEvents: eventi da aggiungere:', events.map(e => ({ id: e.id, title: e.title, start: e.start })));
                    try {
                        // Aggiungi eventi uno per uno per debug
                        events.forEach(event => {
                            try {
                                adminCalendar.addEvent(event);
                            } catch (addError) {
                                console.error('Errore nell\'aggiunta evento:', event, addError);
                            }
                        });
                        console.log('loadCalendarEvents: eventi aggiunti con successo');
                    } catch (addError) {
                        console.error('Errore nell\'aggiunta eventi:', addError);
                        // Prova con addEventSource come fallback
                        try {
                            adminCalendar.addEventSource(events);
                        } catch (sourceError) {
                            console.error('Errore anche con addEventSource:', sourceError);
                        }
                    }
                } else {
                    console.warn('loadCalendarEvents: nessun evento da aggiungere al calendario');
                }
                
                // Forza il refresh del calendario
                try {
                    adminCalendar.render();
                    console.log('loadCalendarEvents: calendario aggiornato con successo');
                } catch (renderError) {
                    console.error('Errore nel rendering calendario:', renderError);
                }
            }, (error) => {
                console.error('Errore nel listener calendario admin:', error);
                console.error('Dettagli errore:', {
                    code: error.code,
                    message: error.message,
                    stack: error.stack
                });
                
                // Se la query fallisce, prova una query ancora più semplice
                if (error.code === 'failed-precondition' || error.code === 'invalid-argument') {
                    console.warn('Query fallita, usando query semplificata...');
                    try {
                        // Query semplificata: carica tutto e filtra completamente lato client
                        adminCalendarUnsubscribe = db.collection('bookings')
                            .onSnapshot((snapshot) => {
                                console.log('loadCalendarEvents (query semplificata): ricevute', snapshot.size, 'prenotazioni');
                                const events = [];
                                snapshot.forEach(doc => {
                                    const booking = doc.data();
                                    
                                    // Filtra tutto lato client
                                    if (booking.companyId && booking.companyId !== currentUser.uid) return;
                                    if (!currentFilters.status && !['pending', 'confirmed'].includes(booking.status)) return;
                                    if (currentFilters.status && booking.status !== currentFilters.status) return;
                                    if (currentFilters.service && booking.service !== currentFilters.service) return;
                                    if (currentFilters.operator && booking.operatorId !== currentFilters.operator) return;
                                    if (!booking.dateTime) return;
                                    
                                    const date = timestampToDate(booking.dateTime);
                                    if (!date || isNaN(date.getTime())) return;
                                    
                                    const serviceNames = {
                                        'toelettatura-completa': 'Toelettatura',
                                        'bagno': 'Bagno',
                                        'taglio-unghie': 'Taglio Unghie',
                                        'pulizia-orecchie': 'Pulizia Orecchie',
                                        'taglio-pelo': 'Taglio Pelo'
                                    };
                                    const serviceName = serviceNames[booking.service] || booking.service || 'Servizio';
                                    const title = `${booking.animalName || 'N/A'} - ${serviceName}`;
                                    
                                    events.push({
                                        id: doc.id,
                                        title: title,
                                        start: date.toISOString(),
                                        backgroundColor: booking.status === 'confirmed' ? '#4a90e2' : '#f39c12',
                                        extendedProps: { booking: { id: doc.id, ...booking } }
                                    });
                                });
                                
                                // Ordina eventi per data
                                events.sort((a, b) => new Date(a.start) - new Date(b.start));
                                
                                console.log('loadCalendarEvents (query semplificata): aggiungendo', events.length, 'eventi al calendario');
                                adminCalendar.removeAllEvents();
                                if (events.length > 0) {
                                    adminCalendar.addEventSource(events);
                                }
                                adminCalendar.render();
                            }, (simpleError) => {
                                console.error('Anche la query semplificata è fallita:', simpleError);
                            });
                    } catch (simpleError) {
                        console.error('Errore nella query semplificata:', simpleError);
                    }
                }
            });
    } catch (error) {
        console.error('Errore nel caricamento eventi:', error);
    }
}

// Carica prenotazioni del giorno con sincronizzazione in tempo reale
function loadDayBookings() {
    if (!selectedDate) return;

    // Disconnetti il listener precedente se esiste
    if (adminDayBookingsUnsubscribe) {
        adminDayBookingsUnsubscribe();
    }

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
        if (!currentUser) return;
        
        const bookingsList = document.getElementById('adminBookingsList');
        
        // Sincronizzazione in tempo reale - filtriamo lato client per retrocompatibilità
        adminDayBookingsUnsubscribe = db.collection('bookings')
            .where('dateTime', '>=', firebase.firestore.Timestamp.fromDate(startOfDay))
            .where('dateTime', '<=', firebase.firestore.Timestamp.fromDate(endOfDay))
            .orderBy('dateTime', 'asc')
            .onSnapshot((snapshot) => {
                bookingsList.innerHTML = '';

                // Filtra lato client per companyId
                const filtered = snapshot.docs.filter(doc => {
                    const data = doc.data();
                    return !data.companyId || data.companyId === currentUser.uid;
                });

                if (filtered.length === 0) {
                    bookingsList.innerHTML = '<p>Nessuna prenotazione per questo giorno</p>';
                    return;
                }

                filtered.forEach(doc => {
                    const booking = { id: doc.id, ...doc.data() };
                    const bookingCard = createAdminBookingCard(booking);
                    bookingsList.appendChild(bookingCard);
                });
            }, (error) => {
                console.error('Errore nel listener prenotazioni giornaliere:', error);
            });
    } catch (error) {
        console.error('Errore nel caricamento prenotazioni:', error);
    }
}

function createAdminBookingCard(booking) {
    const card = document.createElement('div');
    card.className = `booking-card ${booking.status}`;
    card.onclick = () => showBookingDetail(booking.id);
    card.style.cursor = 'pointer';
    
    const date = timestampToDate(booking.dateTime);
    const serviceNames = {
        'toelettatura-completa': 'Toelettatura Completa',
        'bagno': 'Bagno',
        'taglio-unghie': 'Taglio Unghie',
        'pulizia-orecchie': 'Pulizia Orecchie',
        'taglio-pelo': 'Taglio Pelo'
    };

    card.innerHTML = `
        <div class="booking-card-header">
            <h4>${booking.animalName} (${booking.animalType})</h4>
            <span class="booking-status ${booking.status}">${booking.status}</span>
        </div>
        <p><strong>Cliente:</strong> ${booking.userName || booking.userEmail || 'N/A'}</p>
        <p><strong>Servizio:</strong> ${serviceNames[booking.service] || booking.service}</p>
        <p><strong>Prezzo:</strong> €${(booking.price || 0).toFixed(2)}</p>
        <p><strong>Orario:</strong> ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
        <p><strong>Pagamento:</strong> In Presenza</p>
    `;

    return card;
}

// Mostra dettagli prenotazione
async function showBookingDetail(bookingId) {
    try {
        const doc = await db.collection('bookings').doc(bookingId).get();
        if (!doc.exists) {
            alert('Prenotazione non trovata');
            return;
        }

        const booking = { id: doc.id, ...doc.data() };
        const modal = document.getElementById('bookingDetailModal');
        const details = document.getElementById('bookingDetails');
        
        const date = timestampToDate(booking.dateTime);
        const serviceNames = {
            'toelettatura-completa': 'Toelettatura Completa',
            'bagno': 'Bagno',
            'taglio-unghie': 'Taglio Unghie',
            'pulizia-orecchie': 'Pulizia Orecchie',
            'taglio-pelo': 'Taglio Pelo'
        };

        // Carica dati animale
        let animalData = {};
        if (booking.animalId) {
            const animalDoc = await db.collection('animals').doc(booking.animalId).get();
            if (animalDoc.exists) {
                animalData = animalDoc.data();
            }
        }

        details.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">Cliente:</span>
                <span class="detail-value">${booking.userName || booking.userEmail || 'N/A'}</span>
            </div>
            ${booking.userEmail ? `
            <div class="detail-row">
                <span class="detail-label">Email:</span>
                <span class="detail-value">${booking.userEmail}</span>
            </div>
            ` : ''}
            ${booking.userPhone ? `
            <div class="detail-row">
                <span class="detail-label">Telefono:</span>
                <span class="detail-value">${booking.userPhone}</span>
            </div>
            ` : ''}
            <div class="detail-row">
                <span class="detail-label">Animale:</span>
                <span class="detail-value">${booking.animalName} (${booking.animalType})</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Razza:</span>
                <span class="detail-value">${animalData.breed || booking.animalBreed || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Servizio:</span>
                <span class="detail-value">${serviceNames[booking.service] || booking.service}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Prezzo:</span>
                <span class="detail-value">€${(booking.price || 0).toFixed(2)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Data e Ora:</span>
                <span class="detail-value">${date.toLocaleString('it-IT')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Pagamento:</span>
                <span class="detail-value">In Presenza</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Stato:</span>
                <span class="detail-value"><span class="booking-status ${booking.status}">${booking.status}</span></span>
            </div>
            ${booking.notes ? `
            <div class="detail-row">
                <span class="detail-label">Note Prenotazione:</span>
                <span class="detail-value">${booking.notes}</span>
            </div>
            ` : ''}
        `;

        // Salva bookingId per le azioni
        modal.dataset.bookingId = bookingId;
        modal.dataset.bookingData = JSON.stringify(booking);
        
        // Mostra sempre i tre pulsanti
        const completeBtn = document.getElementById('completeBookingBtn');
        const editBtn = document.getElementById('editBookingBtn');
        const deleteBtn = document.getElementById('deleteBookingBtn');

        // Disabilita "Segna Completata" se già completata o cancellata
        if (booking.status === 'completed' || booking.status === 'cancelled') {
            completeBtn.disabled = true;
            completeBtn.style.opacity = '0.5';
        } else {
            completeBtn.disabled = false;
            completeBtn.style.opacity = '1';
        }

        // I pulsanti sono sempre visibili
        completeBtn.style.display = 'inline-block';
        editBtn.style.display = 'inline-block';
        deleteBtn.style.display = 'inline-block';

        modal.classList.add('show');
    } catch (error) {
        alert('Errore nel caricamento dettagli: ' + error.message);
    }
}

// Aggiorna stato prenotazione
async function updateBookingStatus(newStatus) {
    const modal = document.getElementById('bookingDetailModal');
    const bookingId = modal.dataset.bookingId;

    if (!bookingId) return;

    try {
        const bookingRef = db.collection('bookings').doc(bookingId);
        const bookingDoc = await bookingRef.get();
        const booking = bookingDoc.data();

        await bookingRef.update({
            status: newStatus,
            updatedAt: getTimestamp()
        });

        // Invia notifica se confermata o completata
        if (newStatus === 'confirmed' || newStatus === 'completed') {
            await sendStatusNotification(booking, newStatus);
        }

        modal.classList.remove('show');
        loadAdminData();
        alert(`Prenotazione ${newStatus} con successo!`);
    } catch (error) {
        alert('Errore nell\'aggiornamento: ' + error.message);
    }
}

// Segna prenotazione come completata
async function markBookingCompleted() {
    const modal = document.getElementById('bookingDetailModal');
    const bookingId = modal.dataset.bookingId;

    if (!bookingId) return;

    if (!confirm('Sei sicuro di voler segnare questa prenotazione come completata?')) {
        return;
    }

    try {
        const bookingRef = db.collection('bookings').doc(bookingId);
        const bookingDoc = await bookingRef.get();
        const booking = bookingDoc.data();

        await bookingRef.update({
            status: 'completed',
            updatedAt: getTimestamp()
        });

        // Invia notifica
        try {
            await sendStatusNotification(booking, 'completed');
        } catch (notifError) {
            console.warn('Errore nell\'invio notifica:', notifError);
        }

        modal.classList.remove('show');
        loadAdminData();
        alert('Prenotazione segnata come completata!');
    } catch (error) {
        console.error('Errore nel completamento prenotazione:', error);
        alert('Errore nel completamento della prenotazione: ' + error.message);
    }
}

// Modifica prenotazione
async function editBooking() {
    const modal = document.getElementById('bookingDetailModal');
    const bookingId = modal.dataset.bookingId;

    if (!bookingId) {
        alert('ID prenotazione non trovato');
        return;
    }

    try {
        // Recupera i dati direttamente dal database per avere il timestamp corretto
        const bookingDoc = await db.collection('bookings').doc(bookingId).get();
        
        if (!bookingDoc.exists) {
            alert('Prenotazione non trovata');
            return;
        }
        
        const booking = { id: bookingDoc.id, ...bookingDoc.data() };
        
        // Chiudi il modal dei dettagli
        modal.classList.remove('show');
        
        // Apri il modal di modifica (riutilizziamo il modal di creazione)
        const editModal = document.getElementById('addBookingModal');
        const form = document.getElementById('addBookingForm');
        
        // Popola il form con i dati della prenotazione
        document.getElementById('bookingClientName').value = booking.userName || '';
        document.getElementById('bookingClientEmail').value = booking.userEmail || '';
        document.getElementById('bookingClientPhone').value = booking.userPhone || '';
        document.getElementById('bookingAnimalName').value = booking.animalName || '';
        document.getElementById('bookingAnimalType').value = booking.animalType || '';
        document.getElementById('bookingAnimalBreed').value = booking.animalBreed || '';
        document.getElementById('bookingService').value = booking.service || '';
        document.getElementById('bookingPrice').value = booking.price || '';
        document.getElementById('bookingNotes').value = booking.notes || '';
        
        // Imposta data/ora - gestisci il timestamp Firestore correttamente
        let date;
        if (booking.dateTime) {
            // Se è un Timestamp Firestore
            if (booking.dateTime.toDate && typeof booking.dateTime.toDate === 'function') {
                date = booking.dateTime.toDate();
            } 
            // Se è già una Date
            else if (booking.dateTime instanceof Date) {
                date = booking.dateTime;
            }
            // Se è un oggetto serializzato con seconds/nanoseconds
            else if (booking.dateTime.seconds) {
                date = new Date(booking.dateTime.seconds * 1000);
            }
            // Se è un numero (timestamp Unix)
            else if (typeof booking.dateTime === 'number') {
                date = new Date(booking.dateTime);
            }
            // Prova con timestampToDate come fallback
            else {
                date = timestampToDate(booking.dateTime);
            }
        } else {
            date = new Date();
        }
        
        // Verifica che la data sia valida
        if (!date || isNaN(date.getTime())) {
            console.error('Data non valida:', booking.dateTime);
            date = new Date(); // Usa data corrente come fallback
        }
        
        const dateTimeStr = date.toISOString().slice(0, 16);
        document.getElementById('bookingDateTime').value = dateTimeStr;
        
        // Imposta operatore se presente
        if (booking.operatorId) {
            document.getElementById('bookingOperator').value = booking.operatorId;
        } else {
            document.getElementById('bookingOperator').value = '';
        }
        
        // Salva l'ID della prenotazione da modificare
        form.dataset.editingBookingId = bookingId;
        
        // Cambia il titolo del modal
        const modalTitle = editModal.querySelector('h2');
        if (modalTitle) {
            modalTitle.textContent = 'Modifica Prenotazione';
        }
        
        // Carica operatori
        loadOperatorsForBooking();
        
        // Apri il modal
        editModal.classList.add('show');
    } catch (error) {
        console.error('Errore nell\'apertura modifica prenotazione:', error);
        console.error('Dettagli errore:', {
            message: error.message,
            stack: error.stack,
            bookingId: bookingId
        });
        alert('Errore nell\'apertura della modifica: ' + error.message);
    }
}

// Elimina prenotazione
async function deleteBooking() {
    const modal = document.getElementById('bookingDetailModal');
    const bookingId = modal.dataset.bookingId;

    if (!bookingId) return;

    if (!confirm('Sei sicuro di voler eliminare questa prenotazione? Questa azione non può essere annullata.')) {
        return;
    }

    try {
        await db.collection('bookings').doc(bookingId).delete();
        
        modal.classList.remove('show');
        loadAdminData();
        alert('Prenotazione eliminata con successo!');
    } catch (error) {
        console.error('Errore nell\'eliminazione prenotazione:', error);
        alert('Errore nell\'eliminazione della prenotazione: ' + error.message);
    }
}

// Statistiche con sincronizzazione in tempo reale
function loadStats() {
    // Disconnetti il listener precedente se esiste
    if (adminStatsUnsubscribe) {
        adminStatsUnsubscribe();
    }

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (!currentUser) return;
        
        // Listener per prenotazioni di oggi
        // Nota: per retrocompatibilità, filtriamo lato client se companyId non esiste
        const todayUnsubscribe = db.collection('bookings')
            .where('dateTime', '>=', firebase.firestore.Timestamp.fromDate(today))
            .where('dateTime', '<', firebase.firestore.Timestamp.fromDate(tomorrow))
            .onSnapshot((snapshot) => {
                // Filtra lato client per companyId
                const filtered = snapshot.docs.filter(doc => {
                    const data = doc.data();
                    return !data.companyId || data.companyId === currentUser.uid;
                });
                document.getElementById('todayBookings').textContent = filtered.length;
            }, (error) => {
                console.error('Errore nel listener statistiche oggi:', error);
            });

        // Listener per prenotazioni in attesa
        const pendingUnsubscribe = db.collection('bookings')
            .where('status', '==', 'pending')
            .onSnapshot((snapshot) => {
                // Filtra lato client per companyId
                const filtered = snapshot.docs.filter(doc => {
                    const data = doc.data();
                    return !data.companyId || data.companyId === currentUser.uid;
                });
                document.getElementById('pendingBookings').textContent = filtered.length;
            }, (error) => {
                console.error('Errore nel listener statistiche pending:', error);
            });

        // Listener per prenotazioni completate
        const completedUnsubscribe = db.collection('bookings')
            .where('status', '==', 'completed')
            .onSnapshot((snapshot) => {
                // Filtra lato client per companyId
                const filtered = snapshot.docs.filter(doc => {
                    const data = doc.data();
                    return !data.companyId || data.companyId === currentUser.uid;
                });
                document.getElementById('completedBookings').textContent = filtered.length;
            }, (error) => {
                console.error('Errore nel listener statistiche completed:', error);
            });

        // Funzione per disconnettere tutti i listener delle statistiche
        adminStatsUnsubscribe = () => {
            todayUnsubscribe();
            pendingUnsubscribe();
            completedUnsubscribe();
        };
    } catch (error) {
        console.error('Errore nel caricamento statistiche:', error);
    }
}

// Carica tutte le prenotazioni con filtri
function loadAllBookings() {
    if (allBookingsUnsubscribe) {
        allBookingsUnsubscribe();
    }

    try {
        if (!currentUser) return;
        
        // Query base - filtriamo lato client per retrocompatibilità
        let query = db.collection('bookings');
        
        // Applica filtri data
        if (currentFilters.startDate) {
            const startDate = new Date(currentFilters.startDate);
            startDate.setHours(0, 0, 0, 0);
            query = query.where('dateTime', '>=', firebase.firestore.Timestamp.fromDate(startDate));
        }
        
        if (currentFilters.endDate) {
            const endDate = new Date(currentFilters.endDate);
            endDate.setHours(23, 59, 59, 999);
            query = query.where('dateTime', '<=', firebase.firestore.Timestamp.fromDate(endDate));
        }
        
        if (currentFilters.service) {
            query = query.where('service', '==', currentFilters.service);
        }
        
        const bookingsList = document.getElementById('adminBookingsList');
        
        allBookingsUnsubscribe = query
            .orderBy('dateTime', 'desc')
            .onSnapshot((snapshot) => {
                bookingsList.innerHTML = '';

                if (snapshot.empty) {
                    bookingsList.innerHTML = '<p>Nessuna prenotazione trovata</p>';
                    return;
                }

                snapshot.forEach(doc => {
                    const booking = { id: doc.id, ...doc.data() };
                    
                    // Filtra per companyId lato client
                    if (booking.companyId && booking.companyId !== currentUser.uid) {
                        return; // Salta prenotazioni di altre aziende
                    }
                    
                    // Filtro operatore
                    if (currentFilters.operator && booking.operatorId !== currentFilters.operator) {
                        return;
                    }
                    
                    const bookingCard = createAdminBookingCard(booking);
                    bookingsList.appendChild(bookingCard);
                });
            }, (error) => {
                console.error('Errore nel listener prenotazioni:', error);
            });
    } catch (error) {
        console.error('Errore nel caricamento prenotazioni:', error);
    }
}

// Statistiche avanzate - usa listener per aggiornamento automatico
let advancedStatsUnsubscribe = null;

function loadAdvancedStats() {
    // Disconnetti il listener precedente se esiste
    if (advancedStatsUnsubscribe) {
        advancedStatsUnsubscribe();
    }

    try {
        if (!currentUser) return;
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        
        // Usa listener in tempo reale invece di query una tantum
        // Filtriamo lato client per retrocompatibilità
        advancedStatsUnsubscribe = db.collection('bookings')
            .orderBy('dateTime', 'desc')
            .onSnapshot((snapshot) => {
                // Filtra per mese corrente e companyId
                const monthlyBookings = snapshot.docs.filter(doc => {
                    const booking = doc.data();
                    // Filtra per companyId
                    if (booking.companyId && booking.companyId !== currentUser.uid) {
                        return false;
                    }
                    const bookingDate = booking.dateTime?.toDate();
                    if (!bookingDate) return false;
                    return bookingDate >= startOfMonth && bookingDate <= endOfMonth;
                });
                
                let revenue = 0;
                let revenueCompleted = 0;
                const serviceCounts = {};
                const clientCounts = {};
                
                monthlyBookings.forEach(doc => {
                    const booking = doc.data();
                    const price = booking.price || 0;
                    const status = booking.status || 'pending';
                    const service = booking.service || 'unknown';
                    
                    // Fatturato reale (solo completate)
                    if (status === 'completed') {
                        revenueCompleted += price;
                    }
                    
                    // Fatturato totale (completate + confermate) - per mostrare anche le prenotazioni confermate
                    if (status === 'completed' || status === 'confirmed') {
                        revenue += price;
                    }
                    
                    // Conta servizi per TUTTE le prenotazioni (non solo completate) per mostrare i servizi più richiesti
                    serviceCounts[service] = (serviceCounts[service] || 0) + 1;
                    
                    // Conta clienti (solo completate per statistiche clienti)
                    if (status === 'completed') {
                        const clientKey = booking.userName || booking.userEmail || 'Sconosciuto';
                        clientCounts[clientKey] = (clientCounts[clientKey] || 0) + 1;
                    }
                });
                
                // Mostra fatturato totale (completate + confermate) per includere anche le prenotazioni passate confermate
                const revenueEl = document.getElementById('monthlyRevenue');
                if (revenueEl) {
                    revenueEl.textContent = `€${revenue.toFixed(2)}`;
                }
                
                // Clienti totali
                const uniqueClients = Object.keys(clientCounts).length;
                const totalClientsEl = document.getElementById('totalClients');
                if (totalClientsEl) {
                    totalClientsEl.textContent = uniqueClients;
                }
                
                // Servizi più richiesti
                const popularServicesEl = document.getElementById('popularServices');
                if (popularServicesEl) {
                    const sortedServices = Object.entries(serviceCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);
                    
                    const serviceNames = {
                        'toelettatura-completa': 'Toelettatura Completa',
                        'bagno': 'Bagno',
                        'taglio-unghie': 'Taglio Unghie',
                        'pulizia-orecchie': 'Pulizia Orecchie',
                        'taglio-pelo': 'Taglio Pelo'
                    };
                    
                    popularServicesEl.innerHTML = sortedServices.length > 0 
                        ? `<ul>${sortedServices.map(([service, count]) => 
                            `<li><span>${serviceNames[service] || service}</span><span>${count}</span></li>`
                        ).join('')}</ul>`
                        : '<p>Nessun dato disponibile</p>';
                }
                
                // Clienti più frequenti
                const topClientsEl = document.getElementById('topClients');
                if (topClientsEl) {
                    const sortedClients = Object.entries(clientCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);
                    
                    topClientsEl.innerHTML = sortedClients.length > 0
                        ? `<ul>${sortedClients.map(([email, count]) => 
                            `<li><span>${email}</span><span>${count} prenotazioni</span></li>`
                        ).join('')}</ul>`
                        : '<p>Nessun dato disponibile</p>';
                }
        
                // Prossime prenotazioni
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                
                const upcoming = monthlyBookings
                    .filter(doc => {
                        const booking = doc.data();
                        const bookingDate = booking.dateTime?.toDate();
                        return bookingDate && bookingDate > now && bookingDate <= nextWeek && (booking.status === 'pending' || booking.status === 'confirmed');
                    })
                    .slice(0, 5);
                
                const upcomingEl = document.getElementById('upcomingBookings');
                if (upcomingEl) {
                    if (upcoming.length > 0) {
                        const serviceNames = {
                            'toelettatura-completa': 'Toelettatura Completa',
                            'bagno': 'Bagno',
                            'taglio-unghie': 'Taglio Unghie',
                            'pulizia-orecchie': 'Pulizia Orecchie',
                            'taglio-pelo': 'Taglio Pelo'
                        };
                        
                        upcomingEl.innerHTML = `<ul>${upcoming.map(doc => {
                            const booking = doc.data();
                            const date = booking.dateTime?.toDate();
                            return `<li><span>${date ? date.toLocaleDateString('it-IT') : 'N/A'} - ${booking.animalName}</span><span>${serviceNames[booking.service] || booking.service}</span></li>`;
                        }).join('')}</ul>`;
                    } else {
                        upcomingEl.innerHTML = '<p>Nessuna prenotazione nei prossimi 7 giorni</p>';
                    }
                }
            }, (error) => {
                console.error('Errore nel listener statistiche avanzate:', error);
            });
    } catch (error) {
        console.error('Errore nel caricamento statistiche avanzate:', error);
    }
}

// Gestione Operatori
function loadOperators() {
    if (operatorsUnsubscribe) {
        operatorsUnsubscribe();
    }

    try {
        const operatorsList = document.getElementById('operatorsList');
        if (!operatorsList) return;
        
        // Carica operatori (se esiste la collection)
        operatorsUnsubscribe = db.collection('operators')
            .onSnapshot((snapshot) => {
                operatorsList.innerHTML = '';
                
              
                
                snapshot.forEach(doc => {
                    const operator = { id: doc.id, ...doc.data() };
                    const operatorCard = createOperatorCard(operator);
                    operatorsList.appendChild(operatorCard);
                });
                
                // Aggiorna select operatori
                updateOperatorSelects();
            }, (error) => {
                console.error('Errore nel caricamento operatori:', error);
            });
    } catch (error) {
        console.error('Errore nel caricamento operatori:', error);
    }
}

function createOperatorCard(operator) {
    const card = document.createElement('div');
    card.className = 'operator-card';
    card.innerHTML = `
        <h4>${operator.name}</h4>
        <p><strong>Email:</strong> ${operator.email}</p>
        <p><strong>Telefono:</strong> ${operator.phone || 'N/A'}</p>
        <p><strong>Ruolo:</strong> ${operator.role === 'manager' ? 'Manager' : 'Operatore'}</p>
        <div class="operator-actions">
            <button class="btn btn-danger" onclick="deleteOperator('${operator.id}')">Elimina</button>
        </div>
    `;
    return card;
}

async function saveOperator() {
    if (!currentUser) return;

    const operatorData = {
        name: document.getElementById('operatorName').value,
        email: document.getElementById('operatorEmail').value,
        phone: document.getElementById('operatorPhone').value,
        role: document.getElementById('operatorRole').value,
        createdAt: getTimestamp()
    };

    try {
        await db.collection('operators').add(operatorData);
        document.getElementById('operatorForm').reset();
        document.getElementById('operatorModal').classList.remove('show');
        loadOperators();
        alert('Operatore salvato con successo!');
    } catch (error) {
        alert('Errore nel salvataggio: ' + error.message);
    }
}

async function deleteOperator(operatorId) {
    if (!confirm('Sei sicuro di voler eliminare questo operatore?')) return;

    try {
        await db.collection('operators').doc(operatorId).delete();
        loadOperators();
    } catch (error) {
        alert('Errore nell\'eliminazione: ' + error.message);
    }
}

function updateOperatorSelects() {
    db.collection('operators').get().then(snapshot => {
        const selects = ['filterOperator', 'filterBookingOperator'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            // Mantieni l'opzione "Tutti"
            const firstOption = select.querySelector('option[value=""]');
            select.innerHTML = '';
            if (firstOption) {
                select.appendChild(firstOption);
            }
            
            snapshot.forEach(doc => {
                const operator = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = operator.name;
                select.appendChild(option);
            });
        });
    });
}

// Reportistica
// Carica i dati del report e mostra i grafici nella pagina
async function loadReportData() {
    const period = document.getElementById('reportPeriod').value;
    let startDate, endDate;
    
    const now = new Date();
    
    switch(period) {
        case 'week':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'quarter':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            break;
        case 'custom':
            const startInput = document.getElementById('reportStartDate').value;
            const endInput = document.getElementById('reportEndDate').value;
            if (!startInput || !endInput) {
                return; // Non fare nulla se le date non sono selezionate
            }
            startDate = new Date(startInput);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(endInput);
            endDate.setHours(23, 59, 59, 999);
            break;
        default:
            return;
    }
    
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return;
    }
    
    try {
        // Sincronizza il periodo delle analytics con quello del report
        const analyticsPeriod = document.getElementById('analyticsPeriod');
        const analyticsStartDate = document.getElementById('analyticsStartDate');
        const analyticsEndDate = document.getElementById('analyticsEndDate');
        
        const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        if (periodDays <= 7) {
            analyticsPeriod.value = '7';
        } else if (periodDays <= 30) {
            analyticsPeriod.value = '30';
        } else if (periodDays <= 90) {
            analyticsPeriod.value = '90';
        } else if (periodDays <= 180) {
            analyticsPeriod.value = '180';
        } else if (periodDays <= 365) {
            analyticsPeriod.value = '365';
        } else {
            analyticsPeriod.value = 'custom';
            if (analyticsStartDate && analyticsEndDate) {
                analyticsStartDate.value = startDate.toISOString().split('T')[0];
                analyticsEndDate.value = endDate.toISOString().split('T')[0];
                const customPeriod = document.getElementById('analyticsCustomPeriod');
                if (customPeriod) {
                    customPeriod.style.display = 'flex';
                }
            }
        }
        
        // Assicurati che il contenuto delle analytics sia visibile
        const advancedContent = document.getElementById('advancedAnalyticsContent');
        if (advancedContent) {
            advancedContent.classList.add('active');
            // Assicurati che i canvas siano nel DOM prima di caricare i grafici
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Carica i grafici delle analytics
        await loadAdvancedAnalytics();
        
    } catch (error) {
        console.error('Errore nel caricamento dati report:', error);
    }
}

// Genera solo il PDF del report (usa i dati già presenti)
async function generateReport() {
    const period = document.getElementById('reportPeriod').value;
    let startDate, endDate;
    
    const now = new Date();
    
    switch(period) {
        case 'week':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'quarter':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            break;
        case 'custom':
            const startInput = document.getElementById('reportStartDate').value;
            const endInput = document.getElementById('reportEndDate').value;
            if (!startInput || !endInput) {
                alert('Seleziona data inizio e data fine per il periodo personalizzato');
                return;
            }
            startDate = new Date(startInput);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(endInput);
            endDate.setHours(23, 59, 59, 999);
            break;
        default:
            alert('Seleziona un periodo valido');
            return;
    }
    
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        alert('Date non valide. Seleziona un periodo valido.');
        return;
    }
    
    try {
        if (!currentUser) return;
        
        // Carica i dati per il PDF - filtriamo lato client per retrocompatibilità
        const allBookingsSnapshot = await db.collection('bookings').get();
        const bookings = allBookingsSnapshot.docs.filter(doc => {
            const booking = doc.data();
            // Filtra per companyId
            if (booking.companyId && booking.companyId !== currentUser.uid) {
                return false;
            }
            const bookingDate = booking.dateTime?.toDate();
            if (!bookingDate) return false;
            return bookingDate >= startDate && bookingDate <= endDate;
        });
        
        const serviceNames = {
            'toelettatura-completa': 'Toelettatura Completa',
            'bagno': 'Bagno',
            'taglio-unghie': 'Taglio Unghie',
            'pulizia-orecchie': 'Pulizia Orecchie',
            'taglio-pelo': 'Taglio Pelo'
        };
        
        let totalRevenue = 0;
        let totalRevenueConfirmed = 0;
        const serviceStats = {};
        const statusCounts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
        
        bookings.forEach(doc => {
            const booking = doc.data();
            const status = booking.status || 'pending';
            const price = booking.price || 0;
            
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            if (status === 'completed') {
                totalRevenue += price;
                const service = booking.service || 'unknown';
                serviceStats[service] = {
                    count: (serviceStats[service]?.count || 0) + 1,
                    revenue: (serviceStats[service]?.revenue || 0) + price
                };
            }
            
            if (status === 'completed' || status === 'confirmed') {
                totalRevenueConfirmed += price;
            }
        });
        
        // Assicurati che i grafici siano renderizzati
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Genera PDF e CSV
        await generatePDFReport(bookings, totalRevenue, totalRevenueConfirmed, statusCounts, serviceStats, serviceNames, startDate, endDate);
        generateCSVReport(bookings, totalRevenue, totalRevenueConfirmed, statusCounts, serviceStats, serviceNames, startDate, endDate);
        
        // Mostra messaggio di successo
        const reportBtn = document.getElementById('generateReportBtn');
        if (reportBtn) {
            const originalText = reportBtn.textContent;
            reportBtn.textContent = 'Report Generato!';
            reportBtn.style.backgroundColor = 'var(--success-color)';
            setTimeout(() => {
                reportBtn.textContent = originalText;
                reportBtn.style.backgroundColor = '';
            }, 2000);
        }
        
    } catch (error) {
        console.error('Errore nella generazione report:', error);
        console.error('Stack:', error.stack);
        alert('Errore nella generazione del report: ' + error.message);
    }
}

// Genera PDF del Report
async function generatePDFReport(bookings, totalRevenue, totalRevenueConfirmed, statusCounts, serviceStats, serviceNames, startDate, endDate) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Colori
        const primaryColor = [30, 64, 175]; // #1e40af
        const secondaryColor = [13, 148, 136]; // #0d9488
        const lightGray = [249, 250, 251]; // #f9fafb
        const darkGray = [31, 41, 55]; // #1f2937
        
        // HEADER con box colorato
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 40, 'F');
        
        // Titolo
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('Report Vendite e Servizi', 105, 20, { align: 'center' });
        
        // Periodo e data
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const periodText = `${startDate.toLocaleDateString('it-IT')} - ${endDate.toLocaleDateString('it-IT')}`;
        doc.text(periodText, 105, 30, { align: 'center' });
        doc.text(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, 105, 36, { align: 'center' });
        
        let yPos = 55;
        doc.setTextColor(...darkGray);
        
        // BOX FATTURATO
        doc.setFillColor(...lightGray);
        doc.roundedRect(10, yPos, 190, 50, 3, 3, 'F');
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.5);
        doc.roundedRect(10, yPos, 190, 50, 3, 3);
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('Fatturato', 15, yPos + 8);
        
        yPos += 12;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...darkGray);
        
        // Fatturato principale in evidenza
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryColor);
        doc.setFontSize(13);
        doc.text(`€${totalRevenueConfirmed.toFixed(2)}`, 180, yPos, { align: 'right' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...darkGray);
        doc.text('Fatturato Totale (Completate + Confermate):', 15, yPos);
        
        yPos += 8;
        doc.text(`Fatturato Completate: €${totalRevenue.toFixed(2)}`, 15, yPos);
        yPos += 6;
        doc.text(`Prenotazioni Totali: ${bookings.length}`, 15, yPos);
        yPos += 6;
        doc.setFontSize(9);
        doc.text(`Completate: ${statusCounts.completed} | Confermate: ${statusCounts.confirmed} | In Attesa: ${statusCounts.pending} | Annullate: ${statusCounts.cancelled}`, 15, yPos);
        
        yPos += 20;
        
        // STATISTICHE SERVIZI con tabella migliorata
        if (Object.keys(serviceStats).length > 0) {
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text('Statistiche Servizi', 15, yPos);
            yPos += 8;
            
            // Header tabella con background colorato
            doc.setFillColor(...primaryColor);
            doc.roundedRect(10, yPos - 5, 190, 8, 2, 2, 'F');
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('Servizio', 15, yPos);
            doc.text('Quantità', 120, yPos);
            doc.text('Fatturato', 170, yPos, { align: 'right' });
            
            yPos += 10;
            doc.setTextColor(...darkGray);
            doc.setFont('helvetica', 'normal');
            
            let rowIndex = 0;
            Object.entries(serviceStats)
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .forEach(([service, stats]) => {
                    if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    // Alternanza colori righe
                    if (rowIndex % 2 === 0) {
                        doc.setFillColor(249, 250, 251);
                        doc.rect(10, yPos - 4, 190, 7, 'F');
                    }
                    
                    doc.setFontSize(10);
                    doc.setTextColor(...darkGray);
                    doc.text(serviceNames[service] || service, 15, yPos);
                    doc.text(stats.count.toString(), 120, yPos);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...secondaryColor);
                    doc.text(`€${stats.revenue.toFixed(2)}`, 190, yPos, { align: 'right' });
                    doc.setFont('helvetica', 'normal');
                    
                    yPos += 7;
                    rowIndex++;
                });
        }
        
        // GRAFICI ANALYTICS AVANZATE
        yPos += 10;
        const chartWidth = 90; // Larghezza grafici (metà pagina)
        const chartHeight = 60; // Altezza grafici
        
        // Funzione helper per aggiungere un grafico al PDF
        const addChartToPDF = (chart, title) => {
            if (!chart) return false;
            
            try {
                const imgData = chart.toBase64Image();
                if (yPos + chartHeight > 270) {
                    doc.addPage();
                    yPos = 20;
                }
                
                // Titolo grafico
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...primaryColor);
                doc.text(title, 15, yPos);
                yPos += 8;
                
                // Aggiungi immagine del grafico
                doc.addImage(imgData, 'PNG', 10, yPos, chartWidth, chartHeight);
                yPos += chartHeight + 10;
                return true;
            } catch (error) {
                console.error(`Errore nel convertire grafico ${title}:`, error);
                return false;
            }
        };
        
        // Aggiungi tutti i grafici
        if (analyticsCharts.revenueTrend) {
            addChartToPDF(analyticsCharts.revenueTrend, 'Trend Fatturato');
        }
        
        if (analyticsCharts.servicePerformance) {
            addChartToPDF(analyticsCharts.servicePerformance, 'Performance Servizi');
        }
        
        if (analyticsCharts.hourlyHeatmap) {
            if (yPos + chartHeight > 270) {
                doc.addPage();
                yPos = 20;
            }
            addChartToPDF(analyticsCharts.hourlyHeatmap, 'Heatmap Orari');
        }
        
        if (analyticsCharts.seasonality) {
            addChartToPDF(analyticsCharts.seasonality, 'Analisi Stagionalità');
        }
        
        if (analyticsCharts.predictions) {
            addChartToPDF(analyticsCharts.predictions, 'Previsioni Prenotazioni');
        }
        
        // DETTAGLIO VENDITE
        if (bookings.length > 0) {
            doc.addPage();
            yPos = 20;
            
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text('Dettaglio Vendite', 15, yPos);
            yPos += 8;
            
            // Header tabella
            doc.setFillColor(...primaryColor);
            doc.roundedRect(10, yPos - 5, 190, 8, 2, 2, 'F');
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('Data', 12, yPos);
            doc.text('Cliente', 50, yPos);
            doc.text('Servizio', 110, yPos);
            doc.text('Prezzo', 160, yPos, { align: 'right' });
            doc.text('Stato', 185, yPos, { align: 'right' });
            
            yPos += 10;
            doc.setTextColor(...darkGray);
            doc.setFont('helvetica', 'normal');
            
            let rowIndex = 0;
            bookings
                .sort((a, b) => {
                    const dateA = a.data().dateTime?.toDate() || new Date(0);
                    const dateB = b.data().dateTime?.toDate() || new Date(0);
                    return dateB - dateA;
                })
                .forEach(docItem => {
                    if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    const booking = docItem.data();
                    const date = booking.dateTime?.toDate();
                    const dateStr = date ? date.toLocaleDateString('it-IT') : 'N/A';
                    const clientName = (booking.userName || booking.userEmail || 'N/A').substring(0, 25);
                    const service = (serviceNames[booking.service] || booking.service || 'N/A').substring(0, 20);
                    const price = booking.price || 0;
                    const status = booking.status || 'pending';
                    
                    // Alternanza colori righe
                    if (rowIndex % 2 === 0) {
                        doc.setFillColor(249, 250, 251);
                        doc.rect(10, yPos - 4, 190, 6, 'F');
                    }
                    
                    doc.setFontSize(8);
                    doc.setTextColor(...darkGray);
                    doc.text(dateStr, 12, yPos);
                    doc.text(clientName, 50, yPos);
                    doc.text(service, 110, yPos);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...secondaryColor);
                    doc.text(`€${price.toFixed(2)}`, 190, yPos, { align: 'right' });
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...darkGray);
                    
                    // Colore stato
                    let statusColor = darkGray;
                    if (status === 'completed') statusColor = [16, 185, 129]; // verde
                    else if (status === 'confirmed') statusColor = [59, 130, 246]; // blu
                    else if (status === 'pending') statusColor = [245, 158, 11]; // giallo
                    else if (status === 'cancelled') statusColor = [239, 68, 68]; // rosso
                    
                    doc.setTextColor(...statusColor);
                    doc.text(status, 185, yPos, { align: 'right' });
                    
                    yPos += 6;
                    rowIndex++;
                });
        }
        
        // FOOTER su ogni pagina
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Pagina ${i} di ${pageCount}`, 105, 285, { align: 'center' });
            doc.text('PetCalendar - Sistema di Gestione Prenotazioni', 105, 290, { align: 'center' });
        }
        
        // Salva PDF
        const fileName = `report_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        
    } catch (error) {
        console.error('Errore nella generazione PDF:', error);
        alert('Errore nella generazione del PDF: ' + error.message);
    }
}

// Genera CSV del Report
function generateCSVReport(bookings, totalRevenue, totalRevenueConfirmed, statusCounts, serviceStats, serviceNames, startDate, endDate) {
    try {
        const csvLines = [];
        
        // Header
        csvLines.push('REPORT VENDITE E SERVIZI');
        csvLines.push(`Periodo: ${startDate.toLocaleDateString('it-IT')} - ${endDate.toLocaleDateString('it-IT')}`);
        csvLines.push(`Data generazione: ${new Date().toLocaleDateString('it-IT')}`);
        csvLines.push('');
        
        // Fatturato
        csvLines.push('FATTURATO');
        csvLines.push(`Fatturato Completate,€${totalRevenue.toFixed(2)}`);
        csvLines.push(`Fatturato Totale (Completate + Confermate),€${totalRevenueConfirmed.toFixed(2)}`);
        csvLines.push(`Prenotazioni Totali,${bookings.length}`);
        csvLines.push(`Completate,${statusCounts.completed}`);
        csvLines.push(`Confermate,${statusCounts.confirmed}`);
        csvLines.push(`In Attesa,${statusCounts.pending}`);
        csvLines.push(`Annullate,${statusCounts.cancelled}`);
        csvLines.push('');
        
        // Statistiche Servizi
        if (Object.keys(serviceStats).length > 0) {
            csvLines.push('STATISTICHE SERVIZI');
            csvLines.push('Servizio,Quantità,Fatturato');
            Object.entries(serviceStats)
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .forEach(([service, stats]) => {
                    csvLines.push(`${serviceNames[service] || service},${stats.count},€${stats.revenue.toFixed(2)}`);
                });
            csvLines.push('');
        }
        
        // Dettaglio Vendite
        csvLines.push('DETTAGLIO VENDITE');
        csvLines.push('Data,Cliente,Email,Telefono,Animale,Tipo Animale,Servizio,Prezzo,Stato,Metodo Pagamento');
        bookings
            .sort((a, b) => {
                const dateA = a.data().dateTime?.toDate() || new Date(0);
                const dateB = b.data().dateTime?.toDate() || new Date(0);
                return dateB - dateA;
            })
            .forEach(doc => {
                const booking = doc.data();
                const date = booking.dateTime?.toDate();
                const dateStr = date ? date.toLocaleDateString('it-IT') + ' ' + date.toLocaleTimeString('it-IT') : 'N/A';
                const clientName = booking.userName || booking.userEmail || 'N/A';
                const email = booking.userEmail || '';
                const phone = booking.userPhone || '';
                const animalName = booking.animalName || 'N/A';
                const animalType = booking.animalType || 'N/A';
                const service = serviceNames[booking.service] || booking.service || 'N/A';
                const price = booking.price || 0;
                const status = booking.status || 'pending';
                const payment = booking.paymentMethod || 'presenza';
                
                csvLines.push(`"${dateStr}","${clientName}","${email}","${phone}","${animalName}","${animalType}","${service}",€${price.toFixed(2)},"${status}","${payment}"`);
            });
        
        // Crea e scarica CSV
        const csvContent = csvLines.join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        const fileName = `report_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`;
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error('Errore nella generazione CSV:', error);
        alert('Errore nella generazione del CSV: ' + error.message);
    }
}

// Export Dati
async function exportData() {
    try {
        const bookings = await db.collection('bookings')
            .orderBy('dateTime', 'desc')
            .get();
        
        const serviceNames = {
            'toelettatura-completa': 'Toelettatura Completa',
            'bagno': 'Bagno',
            'taglio-unghie': 'Taglio Unghie',
            'pulizia-orecchie': 'Pulizia Orecchie',
            'taglio-pelo': 'Taglio Pelo'
        };
        
        const csvData = [
            ['Data', 'Ora', 'Cliente', 'Animale', 'Servizio', 'Stato', 'Pagamento'].join(',')
        ];
        
        bookings.forEach(doc => {
            const booking = doc.data();
            const date = timestampToDate(booking.dateTime);
            csvData.push([
                date.toLocaleDateString('it-IT'),
                date.toLocaleTimeString('it-IT'),
                booking.userEmail,
                booking.animalName,
                serviceNames[booking.service] || booking.service,
                booking.status,
                booking.paymentMethod
            ].join(','));
        });
        
        const csvContent = csvData.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `prenotazioni_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert('Dati esportati con successo!');
    } catch (error) {
        console.error('Errore nell\'export:', error);
        alert('Errore nell\'export dei dati: ' + error.message);
    }
}

// Notifiche
async function sendStatusNotification(booking, status) {
    if (typeof window.sendStatusNotification === 'function') {
        await window.sendStatusNotification(booking, status);
    } else {
        console.log('Invio notifica cambio stato:', status, booking);
    }
}

// Settings Management
async function loadSettings() {
    if (!currentUser) return;

    try {
        // Carica profilo azienda
        const companyDoc = await db.collection('companies').doc(currentUser.uid).get();
        if (companyDoc.exists) {
            const company = companyDoc.data();
            document.getElementById('companyName').value = company.name || '';
            document.getElementById('companyVat').value = company.vat || '';
            document.getElementById('companyAddress').value = company.address || '';
            document.getElementById('companyCity').value = company.city || '';
            document.getElementById('companyZip').value = company.zip || '';
            document.getElementById('companyPhone').value = company.phone || '';
            document.getElementById('companyEmail').value = company.email || '';
            document.getElementById('companyWebsite').value = company.website || '';
        }

        // Carica abbonamento
        const subscriptionDoc = await db.collection('subscriptions').doc(currentUser.uid).get();
        if (subscriptionDoc.exists) {
            const subscription = subscriptionDoc.data();
            const planNames = {
                'free': 'Piano FREE',
                'pro': 'Piano PRO',
                'monthly': 'PRO Mensile',
                'yearly': 'PRO Annuale',
                'enterprise': 'Piano ENTERPRISE'
            };
            const planDetails = {
                'free': 'Fino a 50 prenotazioni/mese - 2 operatori',
                'pro': 'Prenotazioni illimitate - Fino a 5 operatori',
                'monthly': 'Prenotazioni illimitate - Fino a 5 operatori - €19,99/mese',
                'yearly': 'Prenotazioni illimitate - Fino a 5 operatori - €119,99/anno',
                'enterprise': 'Operatori e sedi illimitati - Tutte le funzionalità'
            };

            document.getElementById('currentPlanName').textContent = planNames[subscription.plan] || 'Piano FREE';
            document.getElementById('currentPlanDetails').textContent = planDetails[subscription.plan] || '';

            if (subscription.status === 'active') {
                document.getElementById('subscriptionStatus').textContent = 'Attivo';
                document.getElementById('subscriptionStatus').className = 'status-badge status-active';
            } else if (subscription.status === 'cancelled') {
                document.getElementById('subscriptionStatus').textContent = 'Cancellato';
                document.getElementById('subscriptionStatus').className = 'status-badge status-cancelled';
            } else {
                document.getElementById('subscriptionStatus').textContent = 'Inattivo';
                document.getElementById('subscriptionStatus').className = 'status-badge status-inactive';
            }

            if (subscription.expiryDate) {
                const expiry = subscription.expiryDate.toDate();
                document.getElementById('subscriptionExpiry').textContent = `Scadenza: ${expiry.toLocaleDateString('it-IT')}`;
            } else if (subscription.plan === 'monthly' || subscription.plan === 'yearly') {
                // Per abbonamenti Stripe, mostra info dal customer portal se disponibile
                if (subscription.stripeSubscriptionId) {
                    document.getElementById('subscriptionExpiry').textContent = 'Abbonamento attivo - Gestisci da Stripe';
                }
            }
        } else {
            // Default a FREE se non esiste abbonamento
            document.getElementById('currentPlanName').textContent = 'Piano FREE';
            document.getElementById('currentPlanDetails').textContent = 'Fino a 50 prenotazioni/mese - 2 operatori';
            document.getElementById('subscriptionStatus').textContent = 'Attivo';
            document.getElementById('subscriptionStatus').className = 'status-badge status-active';
        }

        // Carica email account
        document.getElementById('accountEmail').value = currentUser.email || '';

        // Genera e mostra il link di prenotazione
        loadBookingLink();
    } catch (error) {
        console.error('Errore nel caricamento impostazioni:', error);
    }
}

// Carica e mostra il link di prenotazione
function loadBookingLink() {
    if (!currentUser) return;

    // Controlla se stanno usando file:// invece di http://
    const currentUrl = window.location.href;
    const isFileProtocol = currentUrl.startsWith('file://');
    
    if (isFileProtocol) {
        console.warn('⚠️ ATTENZIONE: Stai usando file:// invece di un server HTTP!');
        const linkInput = document.getElementById('bookingLink');
        const linkStatus = document.getElementById('linkStatus');
        
        if (linkInput) {
            linkInput.value = 'ERRORE: Avvia un server HTTP (vedi istruzioni sotto)';
            linkInput.style.color = '#dc2626';
        }
        
        if (linkStatus) {
            linkStatus.innerHTML = '⚠️ <strong>IMPORTANTE:</strong> Devi avviare un server HTTP!<br>' +
                'Apri il terminale nella directory del progetto ed esegui:<br>' +
                '<code style="background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px;">python3 -m http.server 8000</code><br>' +
                'Poi apri: <code style="background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px;">http://localhost:8000/admin.html</code>';
            linkStatus.style.color = '#dc2626';
            linkStatus.style.whiteSpace = 'normal';
        }
        return;
    }

    // Genera il link in modo robusto che funziona sia in localhost che in produzione
    // Usa window.location per ottenere l'URL corrente
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    
    // Verifica che currentUser.uid esista
    if (!currentUser || !currentUser.uid) {
        const linkInput = document.getElementById('bookingLink');
        const linkStatus = document.getElementById('linkStatus');
        if (linkInput) {
            linkInput.value = 'ERRORE: Utente non autenticato. Effettua il login.';
            linkInput.style.color = '#dc2626';
        }
        if (linkStatus) {
            linkStatus.textContent = '✗ Errore: Utente non autenticato';
            linkStatus.style.color = '#dc2626';
        }
        return;
    }
    
    let bookingLink;
    
    // Metodo principale: sostituisci admin.html con booking.html nel pathname
    // Aggiungiamo companyId sia nei query params che nell'hash come fallback
    if (pathname.includes('admin.html')) {
        // Sostituisci direttamente admin.html con booking.html
        const bookingPath = pathname.replace(/admin\.html.*$/, 'booking.html');
        // Aggiungi companyId sia nei query params che nell'hash (per server che perdono i parametri)
        bookingLink = `${origin}${bookingPath}?companyId=${currentUser.uid}#companyId=${currentUser.uid}`;
    } else {
        // Se non c'è admin.html nel path, aggiungi booking.html alla fine del path
        // Rimuovi eventuali query string e hash
        const cleanPath = pathname.split('?')[0].split('#')[0];
        // Rimuovi il nome file finale se presente
        const dirPath = cleanPath.substring(0, cleanPath.lastIndexOf('/') + 1);
        // Aggiungi companyId sia nei query params che nell'hash (per server che perdono i parametri)
        bookingLink = `${origin}${dirPath}booking.html?companyId=${currentUser.uid}#companyId=${currentUser.uid}`;
    }
    
    // Verifica che il link contenga companyId
    if (!bookingLink.includes('companyId=')) {
        bookingLink = `${origin}${pathname.replace(/admin\.html.*$/, '')}booking.html?companyId=${currentUser.uid}#companyId=${currentUser.uid}`;
    }
    
    const linkInput = document.getElementById('bookingLink');
    const linkStatus = document.getElementById('linkStatus');
    
    if (linkInput) {
        // Verifica che il link contenga companyId
        if (!bookingLink.includes('companyId=') || !bookingLink.includes(currentUser.uid)) {
            linkInput.value = 'ERRORE: Link non valido - manca companyId';
            linkInput.style.color = '#dc2626';
            if (linkStatus) {
                linkStatus.textContent = '✗ ERRORE: Link non valido. Ricarica la pagina.';
                linkStatus.style.color = '#dc2626';
            }
            return;
        }
        
        linkInput.value = bookingLink;
        linkInput.style.color = ''; // Reset colore
        
        // Verifica se siamo in produzione o localhost
        const isProduction = !origin.includes('localhost') && !origin.includes('127.0.0.1');
        const envText = isProduction ? 'Produzione' : 'Localhost';
        
        if (linkStatus) {
            linkStatus.textContent = `✓ Link generato correttamente (${envText})`;
            linkStatus.style.color = '#10b981';
            linkStatus.style.whiteSpace = 'normal';
        }
        
        // Salva companyId in sessionStorage come fallback (per server che perdono i parametri)
        try {
            sessionStorage.setItem('booking_companyId', currentUser.uid);
        } catch (e) {
            // Ignora errori di sessionStorage
        }
        
        // Genera QR code dopo che il link è stato generato
        generateQRCode(bookingLink);
    } else {
        if (linkStatus) {
            linkStatus.textContent = '✗ Errore: campo link non trovato';
            linkStatus.style.color = '#dc2626';
        }
    }
}

// Copia il link negli appunti
function copyBookingLink() {
    const linkInput = document.getElementById('bookingLink');
    if (!linkInput) return;

    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // Per dispositivi mobili

    try {
        document.execCommand('copy');
        
        // Mostra messaggio di successo
        const successMsg = document.getElementById('linkCopiedMessage');
        if (successMsg) {
            successMsg.style.display = 'block';
            setTimeout(() => {
                successMsg.style.display = 'none';
            }, 3000);
        }
        
        // Feedback visivo
        const copyBtn = document.getElementById('copyLinkBtn');
        if (copyBtn) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✓ Copiato!';
            copyBtn.style.background = 'var(--success-color)';
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '';
            }, 2000);
        }
    } catch (err) {
        console.error('Errore nella copia:', err);
        alert('Impossibile copiare il link. Copialo manualmente.');
    }
}

// Testa il link aprendolo in una nuova scheda
async function testBookingLink() {
    const linkInput = document.getElementById('bookingLink');
    if (!linkInput) {
        alert('Errore: Campo link non trovato. Ricarica la pagina e riprova.');
        return;
    }
    
    const link = linkInput.value;
    
    if (!link || link.trim() === '') {
        alert('Errore: Il link è vuoto. Assicurati di essere loggato e che il link sia stato generato correttamente.');
        return;
    }
    
    // Verifica che il link contenga booking.html
    if (!link.includes('booking.html')) {
        alert('Errore: Il link non sembra valido.\n\nLink attuale: ' + link + '\n\nControlla che booking.html esista nella stessa directory di admin.html');
        return;
    }
    
    // Prova a verificare se il file esiste (solo se stesso dominio)
    try {
        const fileUrl = link.split('?')[0];
        const response = await fetch(fileUrl, { method: 'HEAD' });
        
        if (!response.ok && response.status === 404) {
            const altUrl1 = window.location.origin + '/booking.html';
            const errorMsg = '⚠️ File booking.html non trovato (404)!\n\n' +
                  'URL richiesto: ' + fileUrl + '\n\n' +
                  'Possibili soluzioni:\n' +
                  '1. Verifica che booking.html sia nella stessa directory di admin.html\n' +
                  '2. Se usi un server locale, avvialo dalla directory del progetto\n' +
                  '3. Prova ad aprire manualmente: ' + altUrl1 + '\n\n' +
                  'Aprendo comunque il link per verificare...';
            
            alert(errorMsg);
        }
    } catch (error) {
        // Ignora errori di verifica (potrebbe essere normale se cross-origin)
    }
    
    // Apri in una nuova scheda
    try {
        const newWindow = window.open(link, '_blank');
        if (!newWindow) {
            alert('Impossibile aprire la nuova finestra. Verifica che il popup blocker non sia attivo.\n\n' +
                  'Alternativa: copia il link e aprilo manualmente nel browser:\n' + link);
        }
    } catch (error) {
        alert('Errore nell\'apertura del link: ' + error.message + '\n\n' +
              'Prova a copiare il link e aprirlo manualmente:\n' + link);
    }
}

// Condividi il link
function shareBookingLink() {
    const linkInput = document.getElementById('bookingLink');
    if (!linkInput) return;

    const link = linkInput.value;
    const text = 'Prenota il tuo appuntamento online: ' + link;

    // Prova a usare l'API Web Share se disponibile
    if (navigator.share) {
        navigator.share({
            title: 'Prenota Appuntamento',
            text: text,
            url: link
        }).catch(err => {
            console.log('Errore nella condivisione:', err);
            fallbackShare(link);
        });
    } else {
        fallbackShare(link);
    }
}

// Testa booking.html direttamente (senza parametri)
function testDirectBooking() {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    let bookingUrl;
    
    if (pathname.includes('admin.html')) {
        bookingUrl = pathname.replace(/admin\.html.*$/, 'booking.html');
    } else {
        const dirPath = pathname.substring(0, pathname.lastIndexOf('/') + 1);
        bookingUrl = dirPath + 'booking.html';
    }
    
    const fullUrl = origin + bookingUrl;
    window.open(fullUrl, '_blank');
}

// Fallback per la condivisione
function fallbackShare(link) {
    // Copia il link
    copyBookingLink();
    
    // Mostra opzioni di condivisione
    const shareOptions = [
        { name: 'Email', action: () => window.location.href = `mailto:?subject=Prenota Appuntamento&body=${encodeURIComponent('Prenota il tuo appuntamento online: ' + link)}` },
        { name: 'WhatsApp', action: () => window.open(`https://wa.me/?text=${encodeURIComponent('Prenota il tuo appuntamento online: ' + link)}`, '_blank') },
        { name: 'Messaggio SMS', action: () => window.location.href = `sms:?body=${encodeURIComponent('Prenota il tuo appuntamento online: ' + link)}` }
    ];
    
    // Mostra un messaggio con il link copiato
    alert('Link copiato negli appunti!\n\n' + 
          'Link: ' + link + '\n\n' +
          'Puoi incollarlo in:\n' +
          '- Email\n' +
          '- WhatsApp\n' +
          '- Messaggi\n' +
          '- Social media\n' +
          '- Sito web');
}

// Condividi via WhatsApp
function shareViaWhatsApp() {
    const linkInput = document.getElementById('bookingLink');
    if (!linkInput) return;
    
    const link = linkInput.value;
    if (!link || link.trim() === '') {
        alert('Il link non è ancora stato generato. Attendi qualche secondo e riprova.');
        return;
    }
    
    // Messaggio precompilato per WhatsApp
    const companyName = document.getElementById('companyName')?.value || 'il nostro salone';
    const message = `🐾 Ciao! Prenota un appuntamento per il tuo animale presso ${companyName}:\n\n${link}\n\nPrenotazione rapida e semplice! 🐕🐈`;
    
    // Apri WhatsApp Web o app
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

// Genera QR Code
function generateQRCode(link) {
    const qrContainer = document.getElementById('qrCodeContainer');
    const qrSection = document.getElementById('qrCodeSection');
    const downloadBtn = document.getElementById('downloadQRBtn');
    
    if (!qrContainer || !qrSection) return;
    
    // Se il link non è disponibile, mostra messaggio di attesa
    if (!link || link.trim() === '') {
        qrContainer.innerHTML = '<p style="color: #666; font-style: italic;">Il QR code verrà generato quando il link sarà disponibile...</p>';
        if (downloadBtn) {
            downloadBtn.style.display = 'none';
        }
        return;
    }
    
    // Verifica che QRCode sia disponibile (qrcodejs usa QRCode come costruttore)
    if (typeof QRCode === 'undefined') {
        // Se non è disponibile, prova ad aspettare un po' e riprova (per caricamento asincrono)
        qrContainer.innerHTML = '<p style="color: #666; font-style: italic;">Caricamento libreria QR Code...</p>';
        setTimeout(() => {
            if (typeof QRCode !== 'undefined') {
                generateQRCode(link); // Riprova
            } else {
                qrContainer.innerHTML = '<p style="color: #dc2626;">Libreria QR Code non disponibile. Ricarica la pagina.</p>';
            }
        }, 1000);
        return;
    }
    
    // Pulisci container precedente
    qrContainer.innerHTML = '';
    
    try {
        // Crea un div temporaneo per il QR code (qrcodejs lo crea automaticamente)
        const qrDiv = document.createElement('div');
        qrDiv.id = 'tempQRCode';
        qrContainer.appendChild(qrDiv);
        
        // Genera QR code usando qrcodejs (API più semplice)
        const qrcode = new QRCode(qrDiv, {
            text: link,
            width: 256,
            height: 256,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
        
        // Mostra sezione QR code
        qrSection.style.display = 'block';
        
        // Mostra pulsante download quando il QR code è generato
        if (downloadBtn) {
            downloadBtn.style.display = 'inline-block';
        }
    } catch (error) {
        console.error('Errore generazione QR code:', error);
        qrContainer.innerHTML = '<p style="color: #dc2626;">Errore nella generazione QR code: ' + error.message + '</p>';
        if (downloadBtn) {
            downloadBtn.style.display = 'none';
        }
    }
}

// Scarica QR Code come immagine
function downloadQRCode() {
    const qrContainer = document.getElementById('qrCodeContainer');
    if (!qrContainer) return;
    
    // qrcodejs crea un canvas o un'immagine all'interno del div
    const canvas = qrContainer.querySelector('canvas');
    const img = qrContainer.querySelector('img');
    
    if (!canvas && !img) {
        alert('QR Code non ancora generato. Attendi qualche secondo.');
        return;
    }
    
    try {
        if (canvas) {
            // Se c'è un canvas, usalo direttamente
            if (canvas.toBlob) {
                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `qr-code-prenotazioni-${new Date().toISOString().split('T')[0]}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 'image/png');
            } else {
                // Fallback per browser vecchi
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `qr-code-prenotazioni-${new Date().toISOString().split('T')[0]}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } else if (img) {
            // Se c'è un'immagine, convertila in canvas e poi scarica
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const ctx = tempCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            tempCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `qr-code-prenotazioni-${new Date().toISOString().split('T')[0]}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 'image/png');
        }
    } catch (error) {
        console.error('Errore download QR code:', error);
        alert('Errore nel download del QR code. Prova a fare screenshot manualmente.');
    }
}

async function saveCompanyProfile() {
    if (!currentUser) return;

    try {
        const companyData = {
            name: document.getElementById('companyName').value,
            vat: document.getElementById('companyVat').value,
            address: document.getElementById('companyAddress').value,
            city: document.getElementById('companyCity').value,
            zip: document.getElementById('companyZip').value,
            phone: document.getElementById('companyPhone').value,
            email: document.getElementById('companyEmail').value,
            website: document.getElementById('companyWebsite').value,
            updatedAt: getTimestamp()
        };

        await db.collection('companies').doc(currentUser.uid).set(companyData, { merge: true });
        alert('Profilo azienda salvato con successo!');
    } catch (error) {
        console.error('Errore nel salvataggio profilo:', error);
        alert('Errore nel salvataggio: ' + error.message);
    }
}

async function changePassword() {
    if (!currentUser) {
        showPasswordMessage('Devi essere autenticato per cambiare la password.', 'error');
        return;
    }

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Reset messages
    hidePasswordMessage();
    hidePasswordStrength();

    // Validazione
    if (!currentPassword) {
        showPasswordMessage('Inserisci la password attuale.', 'error');
        document.getElementById('currentPassword').focus();
        return;
    }

    if (!newPassword) {
        showPasswordMessage('Inserisci la nuova password.', 'error');
        document.getElementById('newPassword').focus();
        return;
    }

    if (newPassword.length < 6) {
        showPasswordMessage('La password deve essere di almeno 6 caratteri.', 'error');
        document.getElementById('newPassword').focus();
        return;
    }

    if (newPassword !== confirmPassword) {
        showPasswordMessage('Le password non corrispondono. Controlla la conferma password.', 'error');
        document.getElementById('confirmPassword').focus();
        return;
    }

    if (currentPassword === newPassword) {
        showPasswordMessage('La nuova password deve essere diversa dalla password attuale.', 'error');
        document.getElementById('newPassword').focus();
        return;
    }

    // Disabilita il bottone durante l'operazione
    const changeBtn = document.getElementById('changePasswordBtn');
    const originalText = changeBtn.textContent;
    changeBtn.disabled = true;
    changeBtn.textContent = 'Cambio password in corso...';

    try {
        // Re-autenticazione con la password corrente
        const email = currentUser.email;
        const credential = firebase.auth.EmailAuthProvider.credential(email, currentPassword);
        await currentUser.reauthenticateWithCredential(credential);

        // Aggiorna la password
        await currentUser.updatePassword(newPassword);
        
        // Successo
        showPasswordMessage('Password cambiata con successo!', 'success');
        
        // Reset form
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        hidePasswordStrength();

        // Scroll per mostrare il messaggio
        document.getElementById('passwordMessage').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
        console.error('Errore nel cambio password:', error);
        let errorMessage = 'Errore nel cambio password.';
        
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Password attuale errata. Controlla e riprova.';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'Per sicurezza, effettua nuovamente il login prima di cambiare la password.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'La password è troppo debole. Scegli una password più sicura.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showPasswordMessage(errorMessage, 'error');
        document.getElementById('currentPassword').focus();
    } finally {
        // Riabilita il bottone
        changeBtn.disabled = false;
        changeBtn.textContent = originalText;
    }
}

function checkPasswordStrength(password) {
    if (!password) {
        hidePasswordStrength();
        return;
    }

    const strengthDiv = document.getElementById('passwordStrength');
    let strength = 0;
    let message = '';

    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    if (strength <= 2) {
        strengthDiv.className = 'password-strength weak';
        message = 'Password debole';
    } else if (strength <= 3) {
        strengthDiv.className = 'password-strength medium';
        message = 'Password media';
    } else {
        strengthDiv.className = 'password-strength strong';
        message = 'Password forte';
    }

    strengthDiv.textContent = message;
    strengthDiv.style.display = 'block';
}

function showPasswordMessage(message, type) {
    const messageDiv = document.getElementById('passwordMessage');
    messageDiv.textContent = message;
    messageDiv.className = `password-message ${type}`;
    messageDiv.style.display = 'block';
}

function hidePasswordMessage() {
    const messageDiv = document.getElementById('passwordMessage');
    messageDiv.style.display = 'none';
}

function hidePasswordStrength() {
    const strengthDiv = document.getElementById('passwordStrength');
    strengthDiv.style.display = 'none';
}

async function handlePlanChange(plan) {
    if (!currentUser) return;

    if (plan === 'free') {
        alert('Sei già sul piano FREE');
        return;
    }

    // Gestisci abbonamenti mensili e annuali con Stripe
    if (plan === 'monthly' || plan === 'yearly') {
        const planName = plan === 'monthly' ? 'PRO Mensile (€19,99/mese)' : 'PRO Annuale (€119,99/anno)';
        const price = plan === 'monthly' ? '19.99' : '119.99';
        
        const confirmUpgrade = confirm(`Vuoi sottoscrivere l'abbonamento ${planName}?`);
        if (!confirmUpgrade) return;

        try {
            // Avvia checkout Stripe
            if (typeof handleSubscriptionCheckout === 'function') {
                await handleSubscriptionCheckout(plan, price);
            } else {
                alert('Sistema di pagamento non disponibile. Contatta il supporto: support@petcalendar.com');
            }
        } catch (error) {
            console.error('Errore nel checkout:', error);
            alert('Errore durante l\'avvio del pagamento. Riprova più tardi.');
        }
        return;
    }

    if (plan === 'enterprise') {
        alert('Per il piano Enterprise, contatta il supporto: support@petcalendar.com');
        return;
    }

    // Gestione legacy per altri piani
    const confirmUpgrade = confirm(`Vuoi passare al piano ${plan.toUpperCase()}?`);
    if (!confirmUpgrade) return;

    try {
        const subscriptionData = {
            plan: plan,
            status: 'active',
            startDate: getTimestamp(),
            expiryDate: null,
            updatedAt: getTimestamp()
        };

        await db.collection('subscriptions').doc(currentUser.uid).set(subscriptionData, { merge: true });
        alert(`Piano ${plan.toUpperCase()} attivato con successo!`);
        loadSettings();
    } catch (error) {
        console.error('Errore nel cambio piano:', error);
        alert('Errore nell\'aggiornamento del piano: ' + error.message);
    }
}

async function deleteAccount() {
    if (!currentUser) return;

    try {
        // Elimina tutti i dati associati
        const batch = db.batch();
        
        // Elimina prenotazioni
        const bookings = await db.collection('bookings').where('companyId', '==', currentUser.uid).get();
        bookings.forEach(doc => batch.delete(doc.ref));

        // Elimina animali
        const animals = await db.collection('animals').where('userId', '==', currentUser.uid).get();
        animals.forEach(doc => batch.delete(doc.ref));

        // Elimina profilo utente
        batch.delete(db.collection('users').doc(currentUser.uid));
        
        // Elimina profilo azienda
        batch.delete(db.collection('companies').doc(currentUser.uid));
        
        // Elimina abbonamento
        batch.delete(db.collection('subscriptions').doc(currentUser.uid));

        await batch.commit();

        // Elimina account Firebase
        await currentUser.delete();
        
        alert('Account eliminato con successo');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Errore nell\'eliminazione account:', error);
        alert('Errore nell\'eliminazione account: ' + error.message);
    }
}

// Gestione Prenotazioni Admin
function openAddBookingModal() {
    const modal = document.getElementById('addBookingModal');
    const form = document.getElementById('addBookingForm');
    const dateTimeInput = document.getElementById('bookingDateTime');
    
    // Reset form e rimuovi flag di modifica
    form.reset();
    delete form.dataset.editingBookingId;
    
    // Imposta data/ora di default (domani alle 10:00)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    dateTimeInput.value = tomorrow.toISOString().slice(0, 16);
    
    // Imposta il titolo corretto
    const modalTitle = modal.querySelector('h2');
    if (modalTitle) {
        modalTitle.textContent = 'Aggiungi Prenotazione';
    }
    
    // Carica operatori nel select
    loadOperatorsForBooking();
    
    modal.classList.add('show');
}

async function loadOperatorsForBooking() {
    try {
        const operatorSelect = document.getElementById('bookingOperator');
        if (!operatorSelect) return;
        
        const operators = await db.collection('operators').get();
        operatorSelect.innerHTML = '<option value="">Nessun operatore assegnato</option>';
        
        operators.forEach(doc => {
            const operator = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = operator.name;
            operatorSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Errore nel caricamento operatori:', error);
    }
}

async function createAdminBooking() {
    if (!currentUser) return;

    const clientName = document.getElementById('bookingClientName').value;
    const clientEmail = document.getElementById('bookingClientEmail').value;
    const clientPhone = document.getElementById('bookingClientPhone').value;
    const animalName = document.getElementById('bookingAnimalName').value;
    const animalType = document.getElementById('bookingAnimalType').value;
    const animalBreed = document.getElementById('bookingAnimalBreed').value;
    const service = document.getElementById('bookingService').value;
    const price = parseFloat(document.getElementById('bookingPrice').value);
    const dateTime = document.getElementById('bookingDateTime').value;
    const operatorId = document.getElementById('bookingOperator').value;
    const notes = document.getElementById('bookingNotes').value;

    if (!clientName || !animalName || !animalType || !service || !dateTime || isNaN(price) || price <= 0) {
        alert('Compila tutti i campi obbligatori (Nome Cliente, Animale, Tipo, Servizio, Prezzo, Data/Ora)');
        return;
    }

    try {
        // Cerca o crea un cliente
        let userId = null;
        let userEmail = clientEmail || '';
        
        if (clientEmail) {
            // Cerca cliente per email se fornita
            const users = await db.collection('users').where('email', '==', clientEmail).limit(1).get();
            
            if (!users.empty) {
                userId = users.docs[0].id;
                // Aggiorna nome se diverso
                const userData = users.docs[0].data();
                if (userData.displayName !== clientName) {
                    await db.collection('users').doc(userId).update({
                        displayName: clientName,
                        phone: clientPhone || userData.phone || '',
                        updatedAt: getTimestamp()
                    });
                }
            } else {
                // Crea nuovo cliente
                const newUserRef = db.collection('users').doc();
                userId = newUserRef.id;
                await newUserRef.set({
                    email: clientEmail,
                    displayName: clientName,
                    phone: clientPhone || '',
                    address: '',
                    createdAt: getTimestamp(),
                    updatedAt: getTimestamp()
                });
            }
        } else {
            // Se non c'è email, crea un cliente senza email
            const newUserRef = db.collection('users').doc();
            userId = newUserRef.id;
            await newUserRef.set({
                email: '',
                displayName: clientName,
                phone: clientPhone || '',
                address: '',
                createdAt: getTimestamp(),
                updatedAt: getTimestamp()
            });
        }

        // Determina lo status: se la data è passata, imposta come "confirmed"
        const bookingDateTime = new Date(dateTime);
        const now = new Date();
        const bookingStatus = bookingDateTime <= now ? 'confirmed' : 'pending';

        const form = document.getElementById('addBookingForm');
        const editingBookingId = form.dataset.editingBookingId;
        
        const bookingData = {
            companyId: currentUser.uid, // Associa prenotazione all'azienda
            userId: userId,
            userName: clientName,
            userEmail: userEmail,
            userPhone: clientPhone || '',
            animalName: animalName,
            animalType: animalType,
            animalBreed: animalBreed || '',
            service: service,
            price: price,
            dateTime: firebase.firestore.Timestamp.fromDate(bookingDateTime),
            operatorId: operatorId || null,
            paymentMethod: 'presenza', // Solo pagamento in presenza
            notes: notes || '',
            updatedAt: getTimestamp()
        };

        if (editingBookingId) {
            // Modifica prenotazione esistente
            const bookingRef = db.collection('bookings').doc(editingBookingId);
            const existingBooking = await bookingRef.get();
            
            if (!existingBooking.exists) {
                alert('Prenotazione non trovata');
                return;
            }
            
            // Mantieni lo status originale se non è stato cambiato manualmente
            const existingData = existingBooking.data();
            bookingData.status = existingData.status;
            bookingData.createdAt = existingData.createdAt; // Mantieni la data di creazione
            bookingData.source = existingData.source || 'admin';
            
            await bookingRef.update(bookingData);
            console.log('Prenotazione modificata con successo:', editingBookingId, bookingData);
            
            // Rimuovi il flag di modifica
            delete form.dataset.editingBookingId;
            
            // Ripristina il titolo del modal
            const modalTitle = document.querySelector('#addBookingModal h2');
            if (modalTitle) {
                modalTitle.textContent = 'Aggiungi Prenotazione';
            }
            
            alert('Prenotazione modificata con successo!');
        } else {
            // Crea nuova prenotazione
            // Determina lo status: se la data è passata, imposta come "confirmed"
            const now = new Date();
            bookingData.status = bookingDateTime <= now ? 'confirmed' : 'pending';
            bookingData.source = 'admin'; // Indica che proviene dalla dashboard admin
            bookingData.createdAt = getTimestamp();
            
            const bookingRef = await db.collection('bookings').add(bookingData);
            console.log('Prenotazione creata con successo:', bookingRef.id, bookingData);
            
            alert('Prenotazione creata con successo!');
        }

        form.reset();
        document.getElementById('addBookingModal').classList.remove('show');
        
        // Non ricaricare manualmente - i listener Firestore si aggiorneranno automaticamente
        // Questo evita loop infiniti e "Maximum call stack size exceeded"
    } catch (error) {
        console.error('Errore nella creazione prenotazione:', error);
        alert('Errore nella creazione della prenotazione: ' + error.message);
    }
}

// ============================================
// ADVANCED ANALYTICS
// ============================================

let analyticsCharts = {
    revenueTrend: null,
    servicePerformance: null,
    hourlyHeatmap: null,
    seasonality: null,
    predictions: null
};

// Load Advanced Analytics
async function loadAdvancedAnalytics() {
    try {
        const period = document.getElementById('analyticsPeriod').value;
        let startDate, endDate;
        
        const now = new Date();
        
        if (period === 'custom') {
            const startInput = document.getElementById('analyticsStartDate').value;
            const endInput = document.getElementById('analyticsEndDate').value;
            if (!startInput || !endInput) {
                alert('Seleziona data inizio e data fine');
                return;
            }
            startDate = new Date(startInput);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(endInput);
            endDate.setHours(23, 59, 59, 999);
        } else {
            const days = parseInt(period);
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - days);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
        }
        
        // Load all bookings in the period
        // NOTA: I dati vengono caricati da Firestore (database cloud), non sono in locale
        // db.collection('bookings') accede al database Firebase Firestore
        if (!currentUser) return;
        
        // Carica tutte le prenotazioni e filtra lato client per retrocompatibilità
        const allBookingsSnapshot = await db.collection('bookings').get();
        const bookings = allBookingsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(booking => {
                // Filtra per companyId
                if (booking.companyId && booking.companyId !== currentUser.uid) {
                    return false;
                }
                const bookingDate = booking.dateTime?.toDate();
                if (!bookingDate) return false;
                return bookingDate >= startDate && bookingDate <= endDate;
            });
        
        if (bookings.length === 0) {
            // Distruggi tutti i grafici esistenti
            Object.keys(analyticsCharts).forEach(key => {
                if (analyticsCharts[key]) {
                    analyticsCharts[key].destroy();
                    analyticsCharts[key] = null;
                }
            });
            // Pulisci le metriche
            document.getElementById('prediction7days').textContent = '-';
            document.getElementById('prediction30days').textContent = '-';
            document.getElementById('predictionRevenue').textContent = '-';
            document.getElementById('avgDailyRevenue').textContent = '€0.00';
            document.getElementById('avgDailyBookings').textContent = '0';
            document.getElementById('avgTicket').textContent = '€0.00';
            document.getElementById('completionRate').textContent = '0%';
            document.getElementById('busiestDay').textContent = '-';
            document.getElementById('peakHour').textContent = '-';
            alert('Nessun dato disponibile per il periodo selezionato');
            return;
        }
        
        // Calculate previous period for comparison
        const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - periodDays);
        const prevEndDate = new Date(startDate);
        
        const prevBookings = allBookingsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(booking => {
                const bookingDate = booking.dateTime?.toDate();
                if (!bookingDate) return false;
                return bookingDate >= prevStartDate && bookingDate < startDate;
            });
        
        // Generate all analytics
        generateRevenueTrendChart(bookings, startDate, endDate);
        generateServicePerformanceChart(bookings);
        generateHourlyHeatmap(bookings);
        generateSeasonalityChart(bookings);
        generatePredictions(bookings);
        calculateKeyMetrics(bookings, prevBookings);
        
    } catch (error) {
        console.error('Errore nel caricamento analytics:', error);
        alert('Errore nel caricamento analytics: ' + error.message);
    }
}

// Revenue Trend Chart
function generateRevenueTrendChart(bookings, startDate, endDate) {
    const ctx = document.getElementById('revenueTrendChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (analyticsCharts.revenueTrend) {
        analyticsCharts.revenueTrend.destroy();
    }
    
    // Group by day
    const daysMap = {};
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const labels = [];
    
    for (let i = 0; i <= days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        daysMap[dateKey] = 0;
        labels.push(date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }));
    }
    
    const now = new Date();
    bookings.forEach(booking => {
        const date = booking.dateTime?.toDate();
        if (date && booking.price) {
            // Includi prenotazioni completate o con data passata
            const isPastDate = date < now;
            if (booking.status === 'completed' || isPastDate) {
                const dateKey = date.toISOString().split('T')[0];
                if (daysMap[dateKey] !== undefined) {
                    daysMap[dateKey] += booking.price || 0;
                }
            }
        }
    });
    
    const revenueData = Object.values(daysMap);
    
    analyticsCharts.revenueTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Fatturato Giornaliero',
                data: revenueData,
                borderColor: 'rgb(30, 64, 175)',
                backgroundColor: 'rgba(30, 64, 175, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '€' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '€' + value.toFixed(0);
                        }
                    }
                }
            }
        }
    });
}

// Service Performance Chart
function generateServicePerformanceChart(bookings) {
    const ctx = document.getElementById('servicePerformanceChart');
    if (!ctx) return;
    
    if (analyticsCharts.servicePerformance) {
        analyticsCharts.servicePerformance.destroy();
    }
    
    const serviceNames = {
        'toelettatura-completa': 'Toelettatura Completa',
        'bagno': 'Bagno',
        'taglio-unghie': 'Taglio Unghie',
        'pulizia-orecchie': 'Pulizia Orecchie',
        'taglio-pelo': 'Taglio Pelo'
    };
    
    const serviceStats = {};
    const now = new Date();
    
    bookings.forEach(booking => {
        const date = booking.dateTime?.toDate();
        if (date) {
            // Includi prenotazioni completate o con data passata
            const isPastDate = date < now;
            if (booking.status === 'completed' || isPastDate) {
                const service = booking.service || 'unknown';
                if (!serviceStats[service]) {
                    serviceStats[service] = { count: 0, revenue: 0 };
                }
                serviceStats[service].count++;
                serviceStats[service].revenue += booking.price || 0;
            }
        }
    });
    
    const labels = Object.keys(serviceStats).map(s => serviceNames[s] || s);
    const countData = Object.values(serviceStats).map(s => s.count);
    const revenueData = Object.values(serviceStats).map(s => s.revenue);
    
    analyticsCharts.servicePerformance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Quantità',
                    data: countData,
                    backgroundColor: 'rgba(30, 64, 175, 0.6)',
                    yAxisID: 'y'
                },
                {
                    label: 'Fatturato (€)',
                    data: revenueData,
                    backgroundColor: 'rgba(13, 148, 136, 0.6)',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantità'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Fatturato (€)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Hourly Heatmap
function generateHourlyHeatmap(bookings) {
    const ctx = document.getElementById('hourlyHeatmapChart');
    if (!ctx) return;
    
    if (analyticsCharts.hourlyHeatmap) {
        analyticsCharts.hourlyHeatmap.destroy();
    }
    
    const daysOfWeek = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8-20
    
    // Initialize heatmap data
    const heatmapData = {};
    daysOfWeek.forEach(day => {
        hours.forEach(hour => {
            heatmapData[`${day}-${hour}`] = 0;
        });
    });
    
    bookings.forEach(booking => {
        const date = booking.dateTime?.toDate();
        if (date) {
            const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1; // Monday = 0
            const hour = date.getHours();
            if (hour >= 8 && hour <= 20) {
                const key = `${daysOfWeek[dayOfWeek]}-${hour}`;
                if (heatmapData[key] !== undefined) {
                    heatmapData[key]++;
                }
            }
        }
    });
    
    // Convert to matrix format for heatmap
    const data = daysOfWeek.map(day => {
        return hours.map(hour => heatmapData[`${day}-${hour}`] || 0);
    });
    
    const maxValue = Math.max(...data.flat());
    
    analyticsCharts.hourlyHeatmap = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: daysOfWeek,
            datasets: hours.map((hour, hourIndex) => ({
                label: `${hour}:00`,
                data: data.map(dayData => dayData[hourIndex]),
                backgroundColor: function(context) {
                    const value = context.parsed.y;
                    const intensity = maxValue > 0 ? value / maxValue : 0;
                    return `rgba(30, 64, 175, ${0.3 + intensity * 0.7})`;
                }
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y} prenotazioni`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Giorno della Settimana'
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Numero Prenotazioni'
                    }
                }
            }
        }
    });
}

// Seasonality Chart
function generateSeasonalityChart(bookings) {
    const ctx = document.getElementById('seasonalityChart');
    if (!ctx) return;
    
    if (analyticsCharts.seasonality) {
        analyticsCharts.seasonality.destroy();
    }
    
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const monthData = Array(12).fill(0);
    const monthRevenue = Array(12).fill(0);
    const now = new Date();
    
    bookings.forEach(booking => {
        const date = booking.dateTime?.toDate();
        if (date) {
            const month = date.getMonth();
            monthData[month]++;
            // Includi prenotazioni completate o con data passata
            const isPastDate = date < now;
            if (booking.status === 'completed' || isPastDate) {
                monthRevenue[month] += booking.price || 0;
            }
        }
    });
    
    analyticsCharts.seasonality = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Prenotazioni',
                    data: monthData,
                    borderColor: 'rgb(30, 64, 175)',
                    backgroundColor: 'rgba(30, 64, 175, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4
                },
                {
                    label: 'Fatturato (€)',
                    data: monthRevenue,
                    borderColor: 'rgb(13, 148, 136)',
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    yAxisID: 'y1',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Prenotazioni'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Fatturato (€)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Predictions
function generatePredictions(bookings) {
    // Simple moving average prediction
    // Includi prenotazioni completate o con data passata
    const now = new Date();
    const completedBookings = bookings.filter(b => {
        const date = b.dateTime?.toDate();
        if (!date) return false;
        const isPastDate = date < now;
        return b.status === 'completed' || isPastDate;
    });
    
    // Calculate average bookings per day
    const bookingDates = completedBookings.map(b => b.dateTime?.toDate()).filter(d => d);
    if (bookingDates.length === 0) {
        document.getElementById('prediction7days').textContent = '-';
        document.getElementById('prediction30days').textContent = '-';
        document.getElementById('predictionRevenue').textContent = '-';
        // Clear prediction chart
        const ctx = document.getElementById('predictionsChart');
        if (ctx && analyticsCharts.predictions) {
            analyticsCharts.predictions.destroy();
            analyticsCharts.predictions = null;
        }
        return;
    }
    
    const firstDate = new Date(Math.min(...bookingDates.map(d => d.getTime())));
    const lastDate = new Date(Math.max(...bookingDates.map(d => d.getTime())));
    const daysDiff = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) || 1;
    const avgBookingsPerDay = completedBookings.length / daysDiff;
    
    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.price || 0), 0);
    const avgRevenue = completedBookings.length > 0 ? totalRevenue / completedBookings.length : 0;
    
    // Predictions
    const prediction7 = Math.round(avgBookingsPerDay * 7);
    const prediction30 = Math.round(avgBookingsPerDay * 30);
    const predictionRevenue = Math.round(avgBookingsPerDay * 30 * avgRevenue);
    
    document.getElementById('prediction7days').textContent = prediction7;
    document.getElementById('prediction30days').textContent = prediction30;
    document.getElementById('predictionRevenue').textContent = '€' + predictionRevenue.toFixed(2);
    
    // Prediction Chart
    const ctx = document.getElementById('predictionsChart');
    if (!ctx) return;
    
    if (analyticsCharts.predictions) {
        analyticsCharts.predictions.destroy();
    }
    
    // Last 7 days actual vs next 7 days predicted
    const last7Days = [];
    const next7Days = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        const dayBookings = bookings.filter(b => {
            const bDate = b.dateTime?.toDate();
            return bDate && bDate.toISOString().split('T')[0] === dateKey;
        }).length;
        last7Days.push(dayBookings);
    }
    
    for (let i = 1; i <= 7; i++) {
        next7Days.push(Math.round(avgBookingsPerDay));
    }
    
    const labels = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }));
    }
    for (let i = 1; i <= 7; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        labels.push(date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }));
    }
    
    analyticsCharts.predictions = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Reale',
                    data: [...last7Days, ...Array(7).fill(null)],
                    borderColor: 'rgb(30, 64, 175)',
                    backgroundColor: 'rgba(30, 64, 175, 0.1)',
                    tension: 0.4,
                    borderDash: []
                },
                {
                    label: 'Previsione',
                    data: [...Array(7).fill(null), ...next7Days],
                    borderColor: 'rgb(13, 148, 136)',
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    tension: 0.4,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Prenotazioni'
                    }
                }
            }
        }
    });
}

// Calculate Key Metrics
function calculateKeyMetrics(bookings, prevBookings) {
    const now = new Date();
    // Includi prenotazioni completate o con data passata
    const completed = bookings.filter(b => {
        const date = b.dateTime?.toDate();
        if (!date) return false;
        const isPastDate = date < now;
        return b.status === 'completed' || isPastDate;
    });
    const prevCompleted = prevBookings.filter(b => {
        const date = b.dateTime?.toDate();
        if (!date) return false;
        const isPastDate = date < now;
        return b.status === 'completed' || isPastDate;
    });
    
    // Average Daily Revenue
    const bookingDates = bookings.map(b => b.dateTime?.toDate()).filter(d => d);
    const days = bookingDates.length > 0 ? Math.ceil((new Date(Math.max(...bookingDates.map(d => d.getTime()))) - new Date(Math.min(...bookingDates.map(d => d.getTime())))) / (1000 * 60 * 60 * 24)) || 1 : 1;
    const totalRevenue = completed.reduce((sum, b) => sum + (b.price || 0), 0);
    const avgDailyRevenue = days > 0 ? totalRevenue / days : 0;
    
    const prevBookingDates = prevBookings.map(b => b.dateTime?.toDate()).filter(d => d);
    const prevDays = prevBookingDates.length > 0 ? Math.ceil((new Date(Math.max(...prevBookingDates.map(d => d.getTime()))) - new Date(Math.min(...prevBookingDates.map(d => d.getTime())))) / (1000 * 60 * 60 * 24)) || 1 : 1;
    const prevTotalRevenue = prevCompleted.reduce((sum, b) => sum + (b.price || 0), 0);
    const prevAvgDailyRevenue = prevDays > 0 ? prevTotalRevenue / prevDays : 0;
    const revenueChange = prevAvgDailyRevenue > 0 ? ((avgDailyRevenue - prevAvgDailyRevenue) / prevAvgDailyRevenue * 100) : 0;
    
    document.getElementById('avgDailyRevenue').textContent = '€' + avgDailyRevenue.toFixed(2);
    const revenueChangeEl = document.getElementById('avgDailyRevenueChange');
    revenueChangeEl.textContent = revenueChange >= 0 ? `+${revenueChange.toFixed(1)}%` : `${revenueChange.toFixed(1)}%`;
    revenueChangeEl.className = 'metric-change ' + (revenueChange >= 0 ? 'positive' : 'negative');
    
    // Average Daily Bookings
    const avgDailyBookings = bookings.length / days;
    const prevAvgDailyBookings = prevBookings.length / prevDays;
    const bookingsChange = prevAvgDailyBookings > 0 ? ((avgDailyBookings - prevAvgDailyBookings) / prevAvgDailyBookings * 100) : 0;
    
    document.getElementById('avgDailyBookings').textContent = Math.round(avgDailyBookings);
    const bookingsChangeEl = document.getElementById('avgDailyBookingsChange');
    bookingsChangeEl.textContent = bookingsChange >= 0 ? `+${bookingsChange.toFixed(1)}%` : `${bookingsChange.toFixed(1)}%`;
    bookingsChangeEl.className = 'metric-change ' + (bookingsChange >= 0 ? 'positive' : 'negative');
    
    // Average Ticket
    const avgTicket = completed.length > 0 ? totalRevenue / completed.length : 0;
    const prevAvgTicket = prevCompleted.length > 0 ? prevTotalRevenue / prevCompleted.length : 0;
    const ticketChange = prevAvgTicket > 0 ? ((avgTicket - prevAvgTicket) / prevAvgTicket * 100) : 0;
    
    document.getElementById('avgTicket').textContent = '€' + avgTicket.toFixed(2);
    const ticketChangeEl = document.getElementById('avgTicketChange');
    ticketChangeEl.textContent = ticketChange >= 0 ? `+${ticketChange.toFixed(1)}%` : `${ticketChange.toFixed(1)}%`;
    ticketChangeEl.className = 'metric-change ' + (ticketChange >= 0 ? 'positive' : 'negative');
    
    // Completion Rate
    const completionRate = bookings.length > 0 ? (completed.length / bookings.length * 100) : 0;
    const prevCompletionRate = prevBookings.length > 0 ? (prevCompleted.length / prevBookings.length * 100) : 0;
    const completionChange = prevCompletionRate > 0 ? (completionRate - prevCompletionRate) : 0;
    
    document.getElementById('completionRate').textContent = completionRate.toFixed(1) + '%';
    const completionChangeEl = document.getElementById('completionRateChange');
    completionChangeEl.textContent = completionChange >= 0 ? `+${completionChange.toFixed(1)}%` : `${completionChange.toFixed(1)}%`;
    completionChangeEl.className = 'metric-change ' + (completionChange >= 0 ? 'positive' : 'negative');
    
    // Busiest Day
    const dayCounts = {};
    bookings.forEach(b => {
        const date = b.dateTime?.toDate();
        if (date) {
            const dayName = date.toLocaleDateString('it-IT', { weekday: 'long' });
            dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
        }
    });
    const busiestDay = Object.keys(dayCounts).length > 0 
        ? Object.keys(dayCounts).reduce((a, b) => dayCounts[a] > dayCounts[b] ? a : b)
        : '-';
    document.getElementById('busiestDay').textContent = busiestDay;
    
    // Peak Hour
    const hourCounts = {};
    bookings.forEach(b => {
        const date = b.dateTime?.toDate();
        if (date) {
            const hour = date.getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
    });
    const peakHour = Object.keys(hourCounts).length > 0
        ? Object.keys(hourCounts).reduce((a, b) => hourCounts[a] > hourCounts[b] ? a : b)
        : '-';
    document.getElementById('peakHour').textContent = peakHour !== '-' ? peakHour + ':00' : '-';
}

