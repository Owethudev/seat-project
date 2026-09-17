import { useEffect, useState } from 'react';
import { requestApi } from './api.js';

function EventLog() {
  const [events, setEvents] = useState([]);
  const [seatNumbers, setSeatNumbers] = useState([]);
  const [seatFilter, setSeatFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrentRequest = true;
    const query = seatFilter ? `?seatNumber=${seatFilter}` : '';

    async function loadEvents() {
      setIsLoading(true);
      setError('');

      try {
        const [eventData, seatData] = await Promise.all([
          requestApi(`/api/events${query}`),
          requestApi('/api/seats')
        ]);

        if (isCurrentRequest) {
          setEvents(eventData.events);
          setSeatNumbers(seatData.seats.map((seat) => seat.number));
        }
      } catch (requestError) {
        if (isCurrentRequest) {
          setError(requestError.message);
        }
      } finally {
        if (isCurrentRequest) {
          setIsLoading(false);
        }
      }
    }

    loadEvents();

    return () => {
      isCurrentRequest = false;
    };
  }, [seatFilter]);

  return (
    <section className="event-log" aria-labelledby="event-log-title">
      <div className="event-log-intro">
        <p className="eyebrow">AUDIT TRAIL</p>
        <h2 id="event-log-title">Event log</h2>
        <p>Read-only history of reservation and waitlist changes.</p>
      </div>

      <div className="event-filter">
        <label htmlFor="event-seat-filter">Filter by seat</label>
        <select
          id="event-seat-filter"
          onChange={(event) => setSeatFilter(event.target.value)}
          value={seatFilter}
        >
          <option value="">All seats</option>
          {seatNumbers.map((seatNumber) => (
            <option key={seatNumber} value={seatNumber}>
              Seat {seatNumber}
            </option>
          ))}
        </select>
        {seatFilter && (
          <button className="clear-filter" onClick={() => setSeatFilter('')} type="button">
            Clear filter
          </button>
        )}
      </div>

      {error && <div className="message message-error" role="alert">{error}</div>}

      {isLoading ? (
        <div className="empty-state">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="empty-state">No events found for this filter.</div>
      ) : (
        <ol className="event-list" aria-label="Reservation event history">
          {events.map((event, index) => (
            <li className="event-item" key={`${event.timestamp}-${event.type}-${index}`}>
              <time dateTime={event.timestamp}>
                {new Date(event.timestamp).toLocaleString()}
              </time>
              <div className="event-details">
                <strong>{event.type.replaceAll('_', ' ')}</strong>
                <span>
                  {event.seatNumber ? `Seat ${event.seatNumber}` : 'Event'}
                  {event.email ? ` · ${event.email}` : ''}
                  {event.holdCode ? ` · ${event.holdCode}` : ''}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default EventLog;
