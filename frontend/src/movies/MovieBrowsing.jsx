import { useEffect, useState } from "react";
import MovieCard from "./MovieCard";
import MovieDetails from "./MovieDetails";

export default function MovieBrowsing({ onBookShowtime, initialView = "home" }) {
  const [result, setResult] = useState({});
  const [view, setView] = useState(initialView);
  const [selection, setSelection] = useState(null);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [date, setDate] = useState("");
  const [finderMovie, setFinderMovie] = useState("");
  const [finderDate, setFinderDate] = useState("");

  function openMovie(movieId, chosenDate) {
    setSelection({ movieId, date: chosenDate });
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadMovies() {
      try {
        const response = await fetch("/api/movies", { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load movies.");
        setResult({ movies: data.movies });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ error: error.message });
      }
    }

    loadMovies();
    return () => controller.abort();
  }, []);

  if (selection) {
    return (
      <MovieDetails
        key={selection.movieId}
        movieId={selection.movieId}
        initialDate={selection.date}
        onBack={() => setSelection(null)}
        onBookShowtime={onBookShowtime}
      />
    );
  }

  const { movies, error } = result;
  if (!movies) {
    return <p role={error ? "alert" : "status"}>{error || "Loading movies…"}</p>;
  }

  const featured = movies[0];
  const genres = [...new Set(movies.map((movie) => movie.genre).filter(Boolean))].sort();
  const search = query.trim().toLowerCase();
  const finderDates = movies.find((movie) => movie.id === finderMovie)?.showDates ?? [];
  const matchingMovies = movies.filter((movie) =>
    movie.title.toLowerCase().includes(search) &&
    (!genre || movie.genre === genre) &&
    (!date || movie.showDates.includes(date))
  );

  return view === "home" ? (
    <section>
      <h1>City Cinema</h1>
      {featured ? (
        <>
          <section>
            <h2>Featured movie</h2>
            <MovieCard movie={featured} onOpenMovie={openMovie} />
          </section>
          <form onSubmit={(event) => {
            event.preventDefault();
            if (finderMovie) openMovie(finderMovie, finderDate);
          }}>
            <h2>Find showtimes</h2>
            <label htmlFor="finder-movie">Movie</label>
            <select id="finder-movie" value={finderMovie} onChange={(event) => {
              setFinderMovie(event.target.value);
              setFinderDate("");
            }}>
              <option value="">Select a movie</option>
              {movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}
            </select>
            <label htmlFor="finder-date">Date</label>
            <select id="finder-date" value={finderDate} onChange={(event) => setFinderDate(event.target.value)}>
              <option value="">Any date</option>
              {finderDates.map((value) => <option key={value}>{value}</option>)}
            </select>
            <button type="submit" disabled={!finderMovie}>Find showtimes</button>
          </form>
          <section>
            <h2>Now showing</h2>
            <div className="movie-grid">
              {movies.slice(0, 4).map((movie) => (
                <MovieCard key={movie.id} movie={movie} onOpenMovie={openMovie} />
              ))}
            </div>
          </section>
          <button type="button" onClick={() => setView("catalog")}>View all movies</button>
        </>
      ) : <p>No movies are showing yet.</p>}
    </section>
  ) : (
    <section>
      <h1>Now Showing</h1>
      <button type="button" onClick={() => setView("home")}>Back to home</button>
      <label>Search movies <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label htmlFor="movie-genre">Genre</label>
      <select id="movie-genre" value={genre} onChange={(event) => setGenre(event.target.value)}>
        <option value="">All genres</option>
        {genres.map((value) => <option key={value}>{value}</option>)}
      </select>
      <label>Show date <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      {matchingMovies.length > 0 ? (
        <div className="movie-grid">
          {matchingMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} onOpenMovie={(id) => openMovie(id, date)} />
          ))}
        </div>
      ) : (
        <p>{movies.length ? "No movies match these filters." : "No movies are showing yet."}</p>
      )}
    </section>
  );
}
