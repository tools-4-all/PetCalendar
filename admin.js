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
    
    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.href = 'index.html';
        } catch (error) {
            alert('Errore durante il logout: ' + error.message);
        }
    });
}

// Calendario Admin
function initCalendar() {
    const calendarEl = document.getElementById('adminCalendar');
    
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
        events: [],
        eventClick: (info) => {
            showBookingDetail(info.event.id);
        },
        dateClick: (info) => {
            selectedDate = info.date;
            loadDayBookings();
        }
    });

    adminCalendar.render();
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
            
            // Aggiungi active al selezionato
            btn.classList.add('active');
            document.getElementById(targetTab + 'Tab').classList.add('active');
            
            // Carica dati specifici per tab
            if (targetTab === 'bookings') {
                loadAllBookings();
            } else if (targetTab === 'reports') {
                generateReport();
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
    document.getElementById('confirmBookingBtn').addEventListener('click', () => {
        updateBookingStatus('confirmed');
    });

    document.getElementById('completeBookingBtn').addEventListener('click', () => {
        updateBookingStatus('completed');
    });

    document.getElementById('cancelBookingBtn').addEventListener('click', () => {
        if (confirm('Sei sicuro di voler annullare questa prenotazione?')) {
            updateBookingStatus('cancelled');
        }
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

    document.getElementById('operatorForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveOperator();
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

    // Export
    document.getElementById('exportDataBtn')?.addEventListener('click', () => {
        exportData();
    });
}

// Caricamento dati admin
async function loadAdminData() {
    if (!currentUser) return;
    
    loadCalendarEvents();
    loadDayBookings();
    loadStats();
    loadAdvancedStats();
}

// Carica eventi calendario con sincronizzazione in tempo reale e filtri
function loadCalendarEvents() {
    // Disconnetti il listener precedente se esiste
    if (adminCalendarUnsubscribe) {
        adminCalendarUnsubscribe();
    }

    if (!adminCalendar) return;

    try {
        let query = db.collection('bookings');
        
        // Applica filtri
        if (currentFilters.status) {
            query = query.where('status', '==', currentFilters.status);
        } else {
            query = query.where('status', 'in', ['pending', 'confirmed']);
        }
        
        if (currentFilters.service) {
            query = query.where('service', '==', currentFilters.service);
        }
        
        // Sincronizzazione in tempo reale
        adminCalendarUnsubscribe = query
            .orderBy('dateTime', 'asc')
            .onSnapshot((snapshot) => {
                const events = [];
                snapshot.forEach(doc => {
                    const booking = doc.data();
                    
                    // Filtro operatore (se implementato)
                    if (currentFilters.operator && booking.operatorId !== currentFilters.operator) {
                        return;
                    }
                    
                    const date = timestampToDate(booking.dateTime);
                    
                    let color = '#f39c12'; // pending
                    if (booking.status === 'confirmed') {
                        color = '#4a90e2';
                    }
                    
                    events.push({
                        id: doc.id,
                        title: `${booking.animalName} - ${booking.service}`,
                        start: date.toISOString(),
                        backgroundColor: color,
                        extendedProps: {
                            booking: { id: doc.id, ...booking }
                        }
                    });
                });

                adminCalendar.removeAllEvents();
                adminCalendar.addEventSource(events);
            }, (error) => {
                console.error('Errore nel listener calendario admin:', error);
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
        const bookingsList = document.getElementById('adminBookingsList');
        
        // Sincronizzazione in tempo reale
        adminDayBookingsUnsubscribe = db.collection('bookings')
            .where('dateTime', '>=', firebase.firestore.Timestamp.fromDate(startOfDay))
            .where('dateTime', '<=', firebase.firestore.Timestamp.fromDate(endOfDay))
            .orderBy('dateTime', 'asc')
            .onSnapshot((snapshot) => {
                bookingsList.innerHTML = '';

                if (snapshot.empty) {
                    bookingsList.innerHTML = '<p>Nessuna prenotazione per questo giorno</p>';
                    return;
                }

                snapshot.forEach(doc => {
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
        <p><strong>Servizio:</strong> ${serviceNames[booking.service] || booking.service}</p>
        <p><strong>Orario:</strong> ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
        <p><strong>Cliente:</strong> ${booking.userEmail}</p>
        <p><strong>Pagamento:</strong> ${booking.paymentMethod === 'online' ? 'Online ✓' : 'In Presenza'}</p>
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
                <span class="detail-label">Animale:</span>
                <span class="detail-value">${booking.animalName} (${booking.animalType})</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Razza:</span>
                <span class="detail-value">${animalData.breed || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Servizio:</span>
                <span class="detail-value">${serviceNames[booking.service] || booking.service}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Data e Ora:</span>
                <span class="detail-value">${date.toLocaleString('it-IT')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Cliente:</span>
                <span class="detail-value">${booking.userEmail}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Pagamento:</span>
                <span class="detail-value">${booking.paymentMethod === 'online' ? 'Online' : 'In Presenza'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Stato:</span>
                <span class="detail-value"><span class="booking-status ${booking.status}">${booking.status}</span></span>
            </div>
            ${animalData.notes ? `
            <div class="detail-row">
                <span class="detail-label">Note Animale:</span>
                <span class="detail-value">${animalData.notes}</span>
            </div>
            ` : ''}
            ${booking.notes ? `
            <div class="detail-row">
                <span class="detail-label">Note Prenotazione:</span>
                <span class="detail-value">${booking.notes}</span>
            </div>
            ` : ''}
        `;

        // Salva bookingId per le azioni
        modal.dataset.bookingId = bookingId;
        
        // Mostra/nascondi pulsanti in base allo stato
        const confirmBtn = document.getElementById('confirmBookingBtn');
        const completeBtn = document.getElementById('completeBookingBtn');
        const cancelBtn = document.getElementById('cancelBookingBtn');

        confirmBtn.style.display = booking.status === 'pending' ? 'block' : 'none';
        completeBtn.style.display = booking.status === 'confirmed' ? 'block' : 'none';
        cancelBtn.style.display = booking.status !== 'cancelled' && booking.status !== 'completed' ? 'block' : 'none';

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

        // Listener per prenotazioni di oggi
        const todayUnsubscribe = db.collection('bookings')
            .where('dateTime', '>=', firebase.firestore.Timestamp.fromDate(today))
            .where('dateTime', '<', firebase.firestore.Timestamp.fromDate(tomorrow))
            .onSnapshot((snapshot) => {
                document.getElementById('todayBookings').textContent = snapshot.size;
            }, (error) => {
                console.error('Errore nel listener statistiche oggi:', error);
            });

        // Listener per prenotazioni in attesa
        const pendingUnsubscribe = db.collection('bookings')
            .where('status', '==', 'pending')
            .onSnapshot((snapshot) => {
                document.getElementById('pendingBookings').textContent = snapshot.size;
            }, (error) => {
                console.error('Errore nel listener statistiche pending:', error);
            });

        // Listener per prenotazioni completate
        const completedUnsubscribe = db.collection('bookings')
            .where('status', '==', 'completed')
            .onSnapshot((snapshot) => {
                document.getElementById('completedBookings').textContent = snapshot.size;
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

// Statistiche avanzate
async function loadAdvancedStats() {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        
        // Fatturato mensile (stima basata su prenotazioni completate)
        const completedBookings = await db.collection('bookings')
            .where('status', '==', 'completed')
            .where('dateTime', '>=', firebase.firestore.Timestamp.fromDate(startOfMonth))
            .where('dateTime', '<=', firebase.firestore.Timestamp.fromDate(endOfMonth))
            .get();
        
        const servicePrices = {
            'toelettatura-completa': 50,
            'bagno': 25,
            'taglio-unghie': 15,
            'pulizia-orecchie': 10,
            'taglio-pelo': 40
        };
        
        let revenue = 0;
        const serviceCounts = {};
        const clientCounts = {};
        
        completedBookings.forEach(doc => {
            const booking = doc.data();
            const price = servicePrices[booking.service] || 30;
            revenue += price;
            
            // Conta servizi
            serviceCounts[booking.service] = (serviceCounts[booking.service] || 0) + 1;
            
            // Conta clienti
            clientCounts[booking.userEmail] = (clientCounts[booking.userEmail] || 0) + 1;
        });
        
        document.getElementById('monthlyRevenue').textContent = `€${revenue}`;
        
        // Clienti totali
        const uniqueClients = Object.keys(clientCounts).length;
        document.getElementById('totalClients').textContent = uniqueClients;
        
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
        
        const upcomingBookings = await db.collection('bookings')
            .where('dateTime', '>=', firebase.firestore.Timestamp.fromDate(now))
            .where('dateTime', '<=', firebase.firestore.Timestamp.fromDate(nextWeek))
            .where('status', 'in', ['pending', 'confirmed'])
            .orderBy('dateTime', 'asc')
            .limit(5)
            .get();
        
        const upcomingEl = document.getElementById('upcomingBookings');
        if (upcomingEl) {
            if (!upcomingBookings.empty) {
                const serviceNames = {
                    'toelettatura-completa': 'Toelettatura Completa',
                    'bagno': 'Bagno',
                    'taglio-unghie': 'Taglio Unghie',
                    'pulizia-orecchie': 'Pulizia Orecchie',
                    'taglio-pelo': 'Taglio Pelo'
                };
                
                upcomingEl.innerHTML = `<ul>${Array.from(upcomingBookings.docs).map(doc => {
                    const booking = doc.data();
                    const date = timestampToDate(booking.dateTime);
                    return `<li><span>${date.toLocaleDateString('it-IT')} - ${booking.animalName}</span><span>${serviceNames[booking.service] || booking.service}</span></li>`;
                }).join('')}</ul>`;
            } else {
                upcomingEl.innerHTML = '<p>Nessuna prenotazione nei prossimi 7 giorni</p>';
            }
        }
        
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
                
                if (snapshot.empty) {
                    operatorsList.innerHTML = '<p>Nessun operatore aggiunto. Clicca su "Aggiungi Operatore" per iniziare.</p>';
                    return;
                }
                
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
async function generateReport() {
    const period = document.getElementById('reportPeriod').value;
    let startDate, endDate;
    
    const now = new Date();
    
    switch(period) {
        case 'week':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            endDate = now;
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'quarter':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            endDate = now;
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            break;
        case 'custom':
            startDate = new Date(document.getElementById('reportStartDate').value);
            endDate = new Date(document.getElementById('reportEndDate').value);
            break;
    }
    
    try {
        const bookings = await db.collection('bookings')
            .where('dateTime', '>=', firebase.firestore.Timestamp.fromDate(startDate))
            .where('dateTime', '<=', firebase.firestore.Timestamp.fromDate(endDate))
            .get();
        
        const servicePrices = {
            'toelettatura-completa': 50,
            'bagno': 25,
            'taglio-unghie': 15,
            'pulizia-orecchie': 10,
            'taglio-pelo': 40
        };
        
        const serviceNames = {
            'toelettatura-completa': 'Toelettatura Completa',
            'bagno': 'Bagno',
            'taglio-unghie': 'Taglio Unghie',
            'pulizia-orecchie': 'Pulizia Orecchie',
            'taglio-pelo': 'Taglio Pelo'
        };
        
        let totalRevenue = 0;
        const serviceStats = {};
        const statusCounts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
        
        bookings.forEach(doc => {
            const booking = doc.data();
            statusCounts[booking.status] = (statusCounts[booking.status] || 0) + 1;
            
            if (booking.status === 'completed') {
                const price = servicePrices[booking.service] || 30;
                totalRevenue += price;
                
                serviceStats[booking.service] = {
                    count: (serviceStats[booking.service]?.count || 0) + 1,
                    revenue: (serviceStats[booking.service]?.revenue || 0) + price
                };
            }
        });
        
        // Report Fatturato
        const revenueEl = document.getElementById('revenueReport');
        if (revenueEl) {
            revenueEl.innerHTML = `
                <p><strong>Fatturato Totale:</strong> €${totalRevenue}</p>
                <p><strong>Prenotazioni Completate:</strong> ${statusCounts.completed}</p>
                <p><strong>Prenotazioni Confermate:</strong> ${statusCounts.confirmed}</p>
                <p><strong>In Attesa:</strong> ${statusCounts.pending}</p>
                <p><strong>Annullate:</strong> ${statusCounts.cancelled}</p>
            `;
        }
        
        // Report Servizi
        const servicesEl = document.getElementById('servicesReport');
        if (servicesEl) {
            const servicesHtml = Object.entries(serviceStats)
                .map(([service, stats]) => `
                    <tr>
                        <td>${serviceNames[service] || service}</td>
                        <td>${stats.count}</td>
                        <td>€${stats.revenue}</td>
                    </tr>
                `).join('');
            
            servicesEl.innerHTML = servicesHtml 
                ? `<table class="report-table">
                    <thead>
                        <tr>
                            <th>Servizio</th>
                            <th>Quantità</th>
                            <th>Fatturato</th>
                        </tr>
                    </thead>
                    <tbody>${servicesHtml}</tbody>
                </table>`
                : '<p>Nessun dato disponibile per il periodo selezionato</p>';
        }
        
        // Report Operatori (placeholder)
        const operatorsEl = document.getElementById('operatorsReport');
        if (operatorsEl) {
            operatorsEl.innerHTML = '<p>Funzionalità in sviluppo. I dati degli operatori verranno mostrati qui.</p>';
        }
        
    } catch (error) {
        console.error('Errore nella generazione report:', error);
        alert('Errore nella generazione del report: ' + error.message);
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

