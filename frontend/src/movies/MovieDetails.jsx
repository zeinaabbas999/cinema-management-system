import { useEffect, useState } from "react";
import { safeMediaUrl } from "./media";

const cinemaTimeZone = "Africa/Cairo";
const dateLabel = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "full",
  timeZone: cinemaTimeZone,
});
const timeLabel = new Intl.DateTimeFormat("en-EG", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: cinemaTimeZone,
});
const priceLabel = new Intl.NumberFormat("en-EG", {
  style: "currency",
  currency: "EGP",
});

export default function MovieDetails({ movieId, initialDate, onBack, onBookShowtime }) {
  const [result, setResult] = useState({});
  const [day, setDay] = useState(initialDate ?? "");
  const [showtimeId, setShowtimeId] = useState("");
  const [bookingSelection, setBookingSelection] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadMovie() {
      try {
        const response = await fetch("/api/movies/" + encodeURIComponent(movieId), {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load this movie.");
        setResult({ movie: data.movie });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ error: error.message });
      }
    }

    loadMovie();
    return () => controller.abort();
  }, [movieId]);

  const { movie, error } = result;
  if (!movie) {
    return (
      <section>
        <button type="button" onClick={onBack}>Back to movies</button>
        <p role={error ? "alert" : "status"}>{error || "Loading movie…"}</p>
      </section>
    );
  }

  const poster = safeMediaUrl(movie.posterUrl);
  const trailer = safeMediaUrl(movie.trailerUrl);
  const dates = new Map();
  for (const showtime of movie.showtimes) {
    const date = showtime.cinemaDate;
    if (!dates.has(date)) dates.set(date, []);
    dates.get(date).push(showtime);
  }
  const selectedDay = dates.has(day) ? day : dates.keys().next().value;
  const showtimes = dates.get(selectedDay) ?? [];
  const selectedShowtime = showtimes.find((showtime) => showtime.id === showtimeId);

  function bookTickets() {
    if (onBookShowtime) {
      onBookShowtime({ movieId: movie.id, showtimeId: selectedShowtime.id });
      return;
    }

    setBookingSelection(
      "Selected " + timeLabel.format(new Date(selectedShowtime.startTime)) +
      " in " + selectedShowtime.hall.name + ". Seat selection will be connected during integration."
    );
  }

  return (
    <section>
      <button type="button" onClick={onBack}>Back to movies</button>
      <h1>{movie.title}</h1>
      {poster && <img src={poster} alt="" width="190" />}
      <p>{[movie.genre, movie.durationMin + " min", movie.language, movie.ageRating]
        .filter(Boolean).join(" · ")}</p>
      {movie.description && <p>{movie.description}</p>}
      {trailer && <p><a href={trailer} target="_blank" rel="noreferrer">Watch trailer</a></p>}

      <h2>Showtimes</h2>
      {showtimes.length === 0 ? (
        <p>No upcoming showtimes for this movie.</p>
      ) : (
        <>
          <label htmlFor="showtime-date">Date</label>
          <select id="showtime-date" value={selectedDay} onChange={(event) => {
            setDay(event.target.value);
            setShowtimeId("");
            setBookingSelection("");
          }}>
            {Array.from(dates.keys(), (date) => <option key={date} value={date}>{dateLabel.format(new Date(date))}</option>)}
          </select>
          <fieldset>
            <legend>Select a showtime (Cairo time)</legend>
            {showtimes.map((showtime) => (
              <p key={showtime.id}>
                <label>
                  <input
                    type="radio"
                    name="showtime"
                    value={showtime.id}
                    checked={showtimeId === showtime.id}
                    onChange={() => {
                      setShowtimeId(showtime.id);
                      setBookingSelection("");
                    }}
                  />
                  {timeLabel.format(new Date(showtime.startTime))} · {showtime.hall.name}
                  {" · "}{priceLabel.format(Number(showtime.basePrice))}
                </label>
              </p>
            ))}
          </fieldset>
          <button type="button" disabled={!selectedShowtime} onClick={bookTickets}>
            Book tickets
          </button>
          {bookingSelection && <p role="status">{bookingSelection}</p>}
        </>
      )}
    </section>
  );
}
