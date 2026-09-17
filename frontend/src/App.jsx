import { useEffect, useState } from 'react';

const POLLING_INTERVAL_MS = 3000;

async function requestApi(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'The request could not be completed.');
  }

  return data;
}

function SeatTile({ seat, selected, onSelect }) {
  const isAvailable = seat.status === 'available';

  return (
    <button
      className={`seat-tile seat-${seat.status}${selected ? ' seat-selected' : ''}`}
      disabled={!isAvailable}
      onClick={() => onSelect(seat.number)}
      type="button"
      aria-pressed={selected}
      aria-label={`Seat ${seat.number}, ${seat.status}`}
    >
      <span className="seat-number">{seat.number}</span>
      <span className="seat-status">{seat.status}</span>
    </button>
  );
}

function App() {
  const [email, setEmail] = useState('');
  const [seats, setSeats] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadSeats(showLoading = false) {
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const data = await requestApi('/api/seats');
      setSeats(data.seats);
      setSelectedSeat((currentSeat) => {
        const stillAvailable = data.seats.some((seat) => (
          seat.number === currentSeat && seat.status === 'available'
        ));
        return stillAvailable ? currentSeat : null;
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    loadSeats(true);
    const intervalId = window.setInterval(() => loadSeats(), POLLING_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  async function handleHold(event) {
    event.preventDefault();

    if (!email.trim() || !selectedSeat) {
      setMessage({ type: 'error', text: 'Enter your email and select an available seat.' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const data = await requestApi('/api/holds', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          seatNumber: selectedSeat
        })
      });
      setMessage({
        type: 'success',
        text: `Seat ${data.hold.seatNumber} is held. Your hold code is ${data.hold.code}.`
      });
      setSelectedSeat(null);
      await loadSeats();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      await loadSeats();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWaitlist() {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Enter your email before joining the waitlist.' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const data = await requestApi('/api/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() })
      });
      setMessage({
        type: 'success',
        text: `You joined the waitlist at position ${data.waitlistEntry.position}.`
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  const availableSeats = seats.filter((seat) => seat.status === 'available');
  const isSoldOut = seats.length > 0 && availableSeats.length === 0;

  return (
    <main className="page-shell">
      <section className="reservation-panel" aria-labelledby="page-title">
        <header className="page-header">
          <div>
            <p className="eyebrow">LIVE EVENT SEATING</p>
            <h1 id="page-title">Choose your seat</h1>
            <p className="intro">Select an available seat to place a temporary hold.</p>
          </div>
          <div className="availability-summary">
            <strong>{availableSeats.length}</strong>
            <span>available</span>
          </div>
        </header>

        <form className="booking-bar" onSubmit={handleHold}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
          <button className="primary-button" disabled={isSubmitting || !selectedSeat} type="submit">
            {isSubmitting ? 'Working...' : selectedSeat ? `Hold seat ${selectedSeat}` : 'Select a seat'}
          </button>
        </form>

        <div className="legend" aria-label="Seat status legend">
          <span><i className="legend-dot available-dot" />Available</span>
          <span><i className="legend-dot held-dot" />Held</span>
          <span><i className="legend-dot confirmed-dot" />Confirmed</span>
        </div>

        {message && (
          <div className={`message message-${message.type}`} role="status">
            {message.text}
          </div>
        )}

        {isLoading ? (
          <div className="empty-state">Loading seats...</div>
        ) : (
          <div className="seat-grid" aria-label="Event seats">
            {seats.map((seat) => (
              <SeatTile
                key={seat.number}
                onSelect={setSelectedSeat}
                seat={seat}
                selected={selectedSeat === seat.number}
              />
            ))}
          </div>
        )}

        {isSoldOut && (
          <section className="waitlist-panel" aria-labelledby="waitlist-title">
            <div>
              <p className="eyebrow">SOLD OUT</p>
              <h2 id="waitlist-title">Stay in line for a seat</h2>
              <p>Join the waitlist and we will hold the next seat that opens.</p>
            </div>
            <button className="secondary-button" disabled={isSubmitting} onClick={handleWaitlist} type="button">
              Join waitlist
            </button>
          </section>
        )}

        <footer className="page-footer">
          <span>Seat status updates automatically</span>
          <span className="live-indicator"><i />Live</span>
        </footer>
      </section>
    </main>
  );
}

export default App;
