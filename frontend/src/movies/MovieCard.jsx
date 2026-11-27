import { safeMediaUrl } from "./media";

export default function MovieCard({ movie, onOpenMovie }) {
  const poster = safeMediaUrl(movie.posterUrl);
  const metadata = [movie.genre, movie.language, movie.ageRating, movie.durationMin + " min"];

  return (
    <article>
      {poster && <img src={poster} alt="" width="145" loading="lazy" />}
      <h3>{movie.title}</h3>
      <p>{metadata.filter(Boolean).join(" · ")}</p>
      <button type="button" onClick={() => onOpenMovie(movie.id)}>
        View showtimes for {movie.title}
      </button>
    </article>
  );
}
