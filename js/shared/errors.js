export function createUserError(message, canRetry = true) {
  const error = new Error(message);
  // `userMessage` separa il testo mostrabile all'utente dal dettaglio tecnico eventuale.
  error.userMessage = message;
  error.canRetry = canRetry;
  return error;
}

export function getUserErrorMessage(err, fallbackMessage = 'Si e verificato un errore imprevisto. Riprova.') {
  // Quando disponibile preferiamo il messaggio gia preparato a monte dai layer API/app.
  if (err && err.userMessage) return err.userMessage;
  return fallbackMessage;
}
