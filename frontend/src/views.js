export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderSeatMap(state) {
  const availableSeats = state.seats.filter((seat) => seat.status === 'available');
  const soldOut = state.seats.length > 0 && availableSeats.length === 0;
  const seatsMarkup = state.isLoading
    ? '<div class="empty-state">Loading seats...</div>'
    : `<div class="seat-grid" aria-label="Event seats">${state.seats.map((seat) => `
        <button class="seat-tile seat-${seat.status}${state.selectedSeat === seat.number ? ' seat-selected' : ''}"
          data-seat-number="${seat.number}"
          ${seat.status === 'available' ? '' : 'disabled'}
          type="button"
          aria-label="Seat ${seat.number}, ${seat.status}">
          <span class="seat-number">${seat.number}</span>
          <span class="seat-status">${seat.status}</span>
        </button>`).join('')}</div>`;
  const waitlistMarkup = soldOut ? `
    <section class="waitlist-panel" aria-labelledby="waitlist-title">
      <div>
        <p class="eyebrow">SOLD OUT</p>
        <h2 id="waitlist-title">Stay in line for a seat</h2>
        <p>Join the waitlist and we will hold the next seat that opens.</p>
      </div>
      <button class="secondary-button" id="join-waitlist" type="button" ${state.isSubmitting ? 'disabled' : ''}>
        Join waitlist
      </button>
    </section>` : '';

  return `
    <form class="booking-bar" id="hold-form">
      <label for="email">Email address
        <input id="email" placeholder="you@example.com" type="email" value="${escapeHtml(state.email)}">
      </label>
      <button class="primary-button" type="submit" ${state.isSubmitting || !state.selectedSeat ? 'disabled' : ''}>
        ${state.isSubmitting ? 'Working...' : state.selectedSeat ? `Hold seat ${state.selectedSeat}` : 'Select a seat'}
      </button>
    </form>
    <div class="legend" aria-label="Seat status legend">
      <span><i class="legend-dot available-dot"></i>Available</span>
      <span><i class="legend-dot held-dot"></i>Held</span>
      <span><i class="legend-dot confirmed-dot"></i>Confirmed</span>
    </div>
    ${state.message ? `<div class="message message-${state.message.type}" role="status">${escapeHtml(state.message.text)}</div>` : ''}
    ${seatsMarkup}
    ${waitlistMarkup}`;
}

export function renderManageHold(state) {
  return `
    <section class="manage-hold" aria-labelledby="manage-title">
      <div class="manage-intro">
        <p class="eyebrow">HOLD MANAGEMENT</p>
        <h2 id="manage-title">Manage your hold</h2>
        <p>Use the details from your hold confirmation to manage your seat.</p>
      </div>
      <form class="manage-form" id="manage-form">
        <label for="manage-email">Email address
          <input id="manage-email" placeholder="you@example.com" type="email">
        </label>
        <label for="hold-code">Hold code
          <input id="hold-code" maxlength="6" placeholder="ABC123" type="text">
        </label>
        <div class="manage-actions">
          <button class="primary-button" name="action" value="confirm" type="submit" ${state.isSubmitting ? 'disabled' : ''}>Confirm</button>
          <button class="secondary-button" name="action" value="extend" type="submit" ${state.isSubmitting ? 'disabled' : ''}>Extend</button>
          <button class="secondary-button" name="action" value="release" type="submit" ${state.isSubmitting ? 'disabled' : ''}>Release</button>
        </div>
      </form>
      ${state.message ? `<div class="message message-${state.message.type}" role="status">${escapeHtml(state.message.text)}</div>` : ''}
    </section>`;
}

export function renderEventLog(state) {
  const eventMarkup = state.isLoading
    ? '<div class="empty-state">Loading events...</div>'
    : state.events.length === 0
      ? '<div class="empty-state">No events found for this filter.</div>'
      : `<ol class="event-list" aria-label="Reservation event history">${state.events.map((event, index) => `
          <li class="event-item" data-event-index="${index}">
            <time datetime="${escapeHtml(event.timestamp)}">${escapeHtml(new Date(event.timestamp).toLocaleString())}</time>
            <div class="event-details">
              <strong>${escapeHtml(event.type.replaceAll('_', ' '))}</strong>
              <span>${event.seatNumber ? `Seat ${event.seatNumber}` : 'Event'}${event.email ? ` · ${escapeHtml(event.email)}` : ''}${event.holdCode ? ` · ${escapeHtml(event.holdCode)}` : ''}</span>
            </div>
          </li>`).join('')}</ol>`;

  return `
    <section class="event-log" aria-labelledby="event-log-title">
      <div class="event-log-intro">
        <p class="eyebrow">AUDIT TRAIL</p>
        <h2 id="event-log-title">Event log</h2>
        <p>Read-only history of reservation and waitlist changes.</p>
      </div>
      <div class="event-filter">
        <label for="event-seat-filter">Filter by seat
          <select id="event-seat-filter">
            <option value="">All seats</option>
            ${state.seats.map((seat) => `<option value="${seat.number}" ${String(seat.number) === state.eventSeatFilter ? 'selected' : ''}>Seat ${seat.number}</option>`).join('')}
          </select>
        </label>
        ${state.eventSeatFilter ? '<button class="clear-filter" id="clear-filter" type="button">Clear filter</button>' : ''}
      </div>
      ${state.message ? `<div class="message message-error" role="alert">${escapeHtml(state.message.text)}</div>` : ''}
      ${eventMarkup}
    </section>`;
}
