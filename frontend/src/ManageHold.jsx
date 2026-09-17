import { useState } from 'react';
import { requestApi } from './api.js';

const ACTIONS = {
  confirm: {
    path: '/api/holds/confirm',
    resultKey: 'confirmation',
    successMessage: 'Your hold was confirmed.'
  },
  extend: {
    path: '/api/holds/extend',
    resultKey: 'hold',
    successMessage: 'Your hold was extended.'
  },
  release: {
    path: '/api/holds/release',
    resultKey: 'release',
    successMessage: 'Your seat was released.'
  }
};

function ManageHold() {
  const [email, setEmail] = useState('');
  const [holdCode, setHoldCode] = useState('');
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAction(event) {
    event.preventDefault();
    const actionName = event.nativeEvent.submitter.value;
    const action = ACTIONS[actionName];

    if (!email.trim() || !holdCode.trim()) {
      setResult({ type: 'error', text: 'Enter your email and hold code.' });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const data = await requestApi(action.path, {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          holdCode: holdCode.trim().toUpperCase()
        })
      });
      const actionResult = data[action.resultKey];
      setResult({
        type: 'success',
        text: `${action.successMessage} ${actionResult.status ? `Status: ${actionResult.status}.` : ''}`.trim()
      });
    } catch (error) {
      setResult({ type: 'error', text: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="manage-hold" aria-labelledby="manage-title">
      <div className="manage-intro">
        <p className="eyebrow">HOLD MANAGEMENT</p>
        <h2 id="manage-title">Manage your hold</h2>
        <p>Use the details from your hold confirmation to manage your seat.</p>
      </div>

      <form className="manage-form" onSubmit={handleAction}>
        <label htmlFor="manage-email">
          Email address
          <input
            id="manage-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </label>
        <label htmlFor="hold-code">
          Hold code
          <input
            id="hold-code"
            maxLength="6"
            onChange={(event) => setHoldCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
            type="text"
            value={holdCode}
          />
        </label>
        <div className="manage-actions">
          {Object.entries(ACTIONS).map(([actionName, action]) => (
            <button
              className={actionName === 'confirm' ? 'primary-button' : 'secondary-button'}
              disabled={isSubmitting}
              key={actionName}
              name="action"
              type="submit"
              value={actionName}
            >
              {isSubmitting ? 'Working...' : actionName}
            </button>
          ))}
        </div>
      </form>

      {result && (
        <div className={`message message-${result.type}`} role="status">
          {result.text}
        </div>
      )}
    </section>
  );
}

export default ManageHold;
