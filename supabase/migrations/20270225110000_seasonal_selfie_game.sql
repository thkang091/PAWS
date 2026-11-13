-- Seasonal Selfie: a monthly photo challenge with a seasonal theme. Its own game value (used by the next migration).
alter type public.tournament_game add value if not exists 'seasonal_selfie';
