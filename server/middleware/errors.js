// Postgres errors that mean the request had bad data. Each maps to a user-readable 400.
// validateRoute catches most of these first; these are the safety net.
const BAD_INPUT_MESSAGES = {
	'22P02': 'The route has an unknown grade or hold role.',
	'23502': 'The route is missing a required field.',
	'23503': "One of the holds isn't in the hold catalog.",
	'23505': "Two holds can't share the same spot on the wall.",
	'23514': 'A hold is off the wall or has an invalid rotation.',
};

// Unmatched /api/* paths
export const notFound = (req, res) => {
	res.status(404).json({ error: 'Not found.' });
};

// Express 5 forwards errors thrown in async handlers here
export const errorHandler = (error, req, res, next) => {
	if (BAD_INPUT_MESSAGES[error.code]) {
		return res.status(400).json({ error: BAD_INPUT_MESSAGES[error.code] });
	}
	// Malformed JSON body (thrown by express.json())
	if (error.type === 'entity.parse.failed') {
		return res.status(400).json({ error: 'The request body is not valid JSON.' });
	}
	console.error(error);
	res.status(500).json({ error: 'Something went wrong. Try again.' });
};
