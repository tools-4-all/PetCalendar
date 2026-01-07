// Sistema di pagamento con Stripe
// IMPORTANTE: Configura Stripe su https://stripe.com/
// e aggiungi la tua chiave pubblica qui

const STRIPE_PUBLIC_KEY = 'YOUR_STRIPE_PUBLIC_KEY';

// Carica Stripe.js (da aggiungere nell'HTML)
// <script src="https://js.stripe.com/v3/"></script>

let stripe = null;
let elements = null;
let cardElement = null;

// Inizializza Stripe
function initStripe() {
    if (typeof Stripe !== 'undefined' && STRIPE_PUBLIC_KEY !== 'YOUR_STRIPE_PUBLIC_KEY') {
        stripe = Stripe(STRIPE_PUBLIC_KEY);
        elements = stripe.elements();
        
        // Crea elemento carta (da aggiungere nel form di pagamento)
        const style = {
            base: {
                color: '#32325d',
                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                fontSmoothing: 'antialiased',
                fontSize: '16px',
                '::placeholder': {
                    color: '#aab7c4'
                }
            },
            invalid: {
                color: '#fa755a',
                iconColor: '#fa755a'
            }
        };

        cardElement = elements.create('card', { style: style });
    }
}

// Monta elemento carta nel container
function mountCardElement(containerId) {
    if (cardElement) {
        cardElement.mount(`#${containerId}`);
    }
}

// Prezzi servizi (in centesimi - €)
const SERVICE_PRICES = {
    'toelettatura-completa': 5000, // €50.00
    'bagno': 2500, // €25.00
    'taglio-unghie': 1000, // €10.00
    'pulizia-orecchie': 800, // €8.00
    'taglio-pelo': 3000 // €30.00
};

// Gestisci pagamento online
window.handleOnlinePayment = async function(bookingId, bookingData) {
    try {
        // Se Stripe non è configurato, salva solo lo stato del pagamento
        if (!stripe || !cardElement || STRIPE_PUBLIC_KEY === 'YOUR_STRIPE_PUBLIC_KEY') {
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
        const session = await createCheckoutSession(bookingId, amount, bookingData);
        
        if (session && session.url) {
            // Reindirizza a Stripe Checkout
            window.location.href = session.url;
        } else {
            // Opzione 2: Payment Element (richiede backend per Payment Intent)
            await processPaymentWithCard(bookingId, amount, bookingData);
        }
    } catch (error) {
        console.error('Errore nel pagamento:', error);
        // Non mostrare alert per evitare interruzioni - la prenotazione è già stata creata
    }
}

// Crea sessione Checkout (richiede backend)
async function createCheckoutSession(bookingId, amount, bookingData) {
    // Per un sito statico, puoi usare Stripe Checkout con un webhook
    // o integrare con un servizio serverless (Firebase Cloud Functions, Vercel, etc.)
    
    // Esempio con Firebase Cloud Functions:
    try {
        // Controlla se Firebase Functions è disponibile
        if (typeof firebase === 'undefined' || !firebase.functions) {
            console.warn('Firebase Functions non disponibile');
            return null;
        }
        
        const functions = firebase.functions();
        const createCheckoutSession = functions.httpsCallable('createCheckoutSession');
        
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

// Processa pagamento con carta (richiede backend)
async function processPaymentWithCard(bookingId, amount, bookingData) {
    // Questo richiede un backend per creare il Payment Intent
    // Per un sito statico, usa Stripe Checkout invece
    
    try {
        // Controlla se Firebase Functions è disponibile
        if (typeof firebase === 'undefined' || !firebase.functions) {
            console.warn('Firebase Functions non disponibile');
            return;
        }
        
        const functions = firebase.functions();
        const createPaymentIntent = functions.httpsCallable('createPaymentIntent');
        
        const { clientSecret } = await createPaymentIntent({
            amount: amount,
            currency: 'eur',
            bookingId: bookingId
        });

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    email: bookingData.userEmail
                }
            }
        });

        if (error) {
            throw error;
        }

        if (paymentIntent.status === 'succeeded') {
            // Verifica che db sia disponibile
            if (typeof db !== 'undefined' && db) {
                const timestamp = typeof getTimestamp === 'function' 
                    ? getTimestamp() 
                    : firebase.firestore.Timestamp.now();
                    
                await db.collection('bookings').doc(bookingId).update({
                    paymentStatus: 'paid',
                    paymentIntentId: paymentIntent.id,
                    paidAt: timestamp
                });
            }
            
            alert('Pagamento completato con successo!');
        }
    } catch (error) {
        console.error('Errore nel pagamento:', error);
        // Non rilanciare l'errore per evitare loop
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

