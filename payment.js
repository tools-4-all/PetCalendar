// Sistema di pagamento con Stripe per abbonamenti
// IMPORTANTE: Configura Stripe su https://stripe.com/
// e aggiungi la tua chiave pubblica qui

const STRIPE_PUBLIC_KEY = 'pk_live_51SnaAiAf30HNX2wt6tSHH4eU7jPnhuwQv9nJ6agCJQBkj1YeL9AO7SAn1dERr4APvu4gI0S3g9G9dzDGYLmlpWVb00eF5zmoJ7';

// Inizializza Stripe
let stripe = null;

function initStripe() {
    if (typeof Stripe !== 'undefined' && STRIPE_PUBLIC_KEY !== 'YOUR_STRIPE_PUBLIC_KEY') {
        stripe = Stripe(STRIPE_PUBLIC_KEY);
        return true;
    }
    return false;
}

// Prezzi abbonamenti (in centesimi - €)
// NOTA: I prezzi effettivi sono quelli configurati su Stripe Dashboard
// Questi valori sono solo per riferimento nel codice
const SUBSCRIPTION_PRICES = {
    'monthly': 1900, // €19.00
    'yearly': 11900  // €119.00
};

// Nomi dei piani
const PLAN_NAMES = {
    'monthly': 'PRO Mensile',
    'yearly': 'PRO Annuale'
};

// Gestisci checkout abbonamento
window.handleSubscriptionCheckout = async function(planType, price) {
    try {
        // Verifica che Stripe sia configurato
        if (!initStripe()) {
            alert('Stripe non è configurato. Contatta il supporto per completare l\'abbonamento.');
            console.warn('Stripe non configurato - STRIPE_PUBLIC_KEY deve essere impostata');
            return;
        }

        if (!currentUser) {
            alert('Devi effettuare il login per sottoscrivere un abbonamento');
            return;
        }

        // Crea sessione checkout Stripe
        // NOTA: Per funzionare completamente, serve un backend (Firebase Cloud Functions)
        // che crei la sessione di checkout. Per ora implementiamo la struttura base.
        
        const checkoutSession = await createCheckoutSession(planType, price);
        
        if (checkoutSession && checkoutSession.url) {
            // Reindirizza a Stripe Checkout
            window.location.href = checkoutSession.url;
        } else {
            // Fallback: mostra messaggio per configurazione backend
            alert('Il sistema di pagamento è in fase di configurazione. Per completare l\'abbonamento, contatta il supporto: support@petcalendar.com');
        }
    } catch (error) {
        console.error('Errore nel checkout abbonamento:', error);
        alert('Errore durante l\'avvio del pagamento. Riprova più tardi.');
    }
};

// Crea sessione Checkout Stripe
// NOTA: Questa funzione richiede un backend (Firebase Cloud Functions o altro)
// per creare la sessione di checkout in modo sicuro
async function createCheckoutSession(planType, price) {
    try {
        // Opzione 1: Usa Firebase Cloud Functions se disponibile
        if (typeof firebase !== 'undefined' && firebase.functions) {
            const functions = firebase.functions();
            const createCheckoutSession = functions.httpsCallable('createSubscriptionCheckout');
            
            const result = await createCheckoutSession({
                planType: planType
            });
            
            return result.data;
        }
        
        // Opzione 2: Usa un endpoint backend personalizzato
        // Sostituisci con il tuo endpoint backend
        const backendUrl = 'YOUR_BACKEND_URL/api/create-checkout-session';
        
        try {
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await currentUser.getIdToken()}`
                },
                body: JSON.stringify({
                    planType: planType,
                    price: price,
                    userId: currentUser.uid,
                    userEmail: currentUser.email
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (fetchError) {
            console.warn('Backend non disponibile:', fetchError);
        }
        
        // Se nessun backend è disponibile, ritorna null
        // L'utente vedrà un messaggio per contattare il supporto
        return null;
    } catch (error) {
        console.error('Errore nella creazione sessione checkout:', error);
        return null;
    }
}

// Verifica stato abbonamento dopo redirect da Stripe
window.verifySubscriptionStatus = async function() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        const success = urlParams.get('success');
        
        if (success === 'true' && sessionId) {
            // Verifica lo stato dell'abbonamento nel database
            if (typeof db !== 'undefined' && db && currentUser) {
                // Aspetta un po' per permettere al webhook di processare il pagamento
                // (il webhook potrebbe richiedere qualche secondo)
                let attempts = 0;
                const maxAttempts = 10; // 5 secondi totali
                
                const checkSubscription = async () => {
                    const subscriptionDoc = await db.collection('subscriptions').doc(currentUser.uid).get();
                    
                    if (subscriptionDoc.exists) {
                        const subscription = subscriptionDoc.data();
                        if (subscription.status === 'active') {
                            alert('Abbonamento attivato con successo!');
                            // Rimuovi i parametri dalla URL
                            window.history.replaceState({}, document.title, window.location.pathname);
                            // Se siamo in admin.html, ricarica le impostazioni
                            if (window.location.pathname.includes('admin.html')) {
                                if (typeof loadSettings === 'function') {
                                    loadSettings();
                                }
                            }
                            return true;
                        }
                    }
                    
                    // Se non ancora attivo, riprova dopo 500ms
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkSubscription, 500);
                    } else {
                        // Se dopo 5 secondi non è ancora attivo, mostra un messaggio
                        alert('Il pagamento è stato ricevuto. L\'abbonamento sarà attivato a breve. Se non vedi l\'abbonamento attivo entro pochi minuti, contatta il supporto.');
                        window.history.replaceState({}, document.title, window.location.pathname);
                        if (window.location.pathname.includes('admin.html')) {
                            if (typeof loadSettings === 'function') {
                                loadSettings();
                            }
                        }
                    }
                    return false;
                };
                
                await checkSubscription();
            } else {
                alert('Pagamento completato! Ricarica la pagina per vedere l\'abbonamento attivo.');
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } else if (success === 'false') {
            alert('Il pagamento è stato annullato.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (error) {
        console.error('Errore nella verifica abbonamento:', error);
        alert('Errore nella verifica dell\'abbonamento. Controlla le impostazioni per vedere lo stato.');
    }
};

// Gestisci pagamento servizi (mantenuto per compatibilità)
const SERVICE_PRICES = {
    'toelettatura-completa': 5000, // €50.00
    'bagno': 2500, // €25.00
    'taglio-unghie': 1000, // €10.00
    'pulizia-orecchie': 800, // €8.00
    'taglio-pelo': 3000 // €30.00
};

// Gestisci pagamento online per servizi
window.handleOnlinePayment = async function(bookingId, bookingData) {
    try {
        // Se Stripe non è configurato, salva solo lo stato del pagamento
        if (!initStripe() || STRIPE_PUBLIC_KEY === 'YOUR_STRIPE_PUBLIC_KEY') {
            console.warn('Stripe non configurato - la prenotazione è stata creata');
            // Aggiorna solo se necessario (evita loop)
            if (typeof db !== 'undefined' && db) {
                try {
                    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
                    if (bookingDoc.exists && !bookingDoc.data().paymentStatus) {
                        await db.collection('bookings').doc(bookingId).update({
                            paymentStatus: 'pending',
                            paymentMethod: 'online'
                        });
                    }
                } catch (updateError) {
                    console.warn('Impossibile aggiornare stato pagamento:', updateError);
                }
            }
            return;
        }

        const amount = SERVICE_PRICES[bookingData.service] || 2000; // Default €20.00

        // Crea Payment Intent sul backend (richiede un backend)
        // Per un sito statico, puoi usare Stripe Checkout invece
        // Questo è un esempio semplificato
        
        // Opzione 1: Stripe Checkout (più semplice per siti statici)
        const session = await createServiceCheckoutSession(bookingId, amount, bookingData);
        
        if (session && session.url) {
            // Reindirizza a Stripe Checkout
            window.location.href = session.url;
        } else {
            console.warn('Impossibile creare sessione checkout per servizio');
        }
    } catch (error) {
        console.error('Errore nel pagamento:', error);
        // Non mostrare alert per evitare interruzioni - la prenotazione è già stata creata
    }
};

// Crea sessione Checkout per servizi
async function createServiceCheckoutSession(bookingId, amount, bookingData) {
    try {
        // Controlla se Firebase Functions è disponibile
        if (typeof firebase === 'undefined' || !firebase.functions) {
            console.warn('Firebase Functions non disponibile');
            return null;
        }
        
        const functions = firebase.functions();
        const createCheckoutSession = functions.httpsCallable('createServiceCheckoutSession');
        
        const result = await createCheckoutSession({
            bookingId: bookingId,
            amount: amount,
            currency: 'eur',
            service: bookingData.service,
            animalName: bookingData.animalName
        });
        
        return result.data;
    } catch (error) {
        console.error('Errore nella creazione della sessione:', error);
        return null;
    }
}

// Verifica stato pagamento (da chiamare dopo il redirect da Stripe Checkout)
async function verifyPaymentStatus(bookingId) {
    try {
        if (typeof db === 'undefined' || !db) {
            console.warn('Database non disponibile');
            return false;
        }
        
        const bookingDoc = await db.collection('bookings').doc(bookingId).get();
        if (bookingDoc.exists) {
            const booking = bookingDoc.data();
            return booking.paymentStatus === 'paid';
        }
        return false;
    } catch (error) {
        console.error('Errore nella verifica pagamento:', error);
        return false;
    }
}

// Formattazione prezzo
function formatPrice(amount) {
    return (amount / 100).toFixed(2) + ' €';
}

// Mostra prezzo nel form di prenotazione
function displayServicePrice(service) {
    const price = SERVICE_PRICES[service] || 2000;
    return formatPrice(price);
}

// Inizializza Stripe al caricamento
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initStripe();
        // Verifica stato abbonamento se ci sono parametri nella URL
        if (window.location.search.includes('session_id')) {
            verifySubscriptionStatus();
        }
    });
}
