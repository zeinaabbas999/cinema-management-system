import { useEffect, useState } from "react";

const EMPTY_FORM = {
  title: "",
  description: "",
  durationMin: "",
  genre: "",
  language: "",
  ageRating: "",
  posterUrl: "",
  trailerUrl: "",
  status: "COMING_SOON",
};

const API_URL = "/api/admin/movies";

export default function AdminMovieManagement({ token }) {
  const [movies, setMovies] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Something went wrong.");
    }

    return data;
  }

  async function loadMovies() {
    if (!token) {
      setError("You must be logged in as an admin.");
      setLoading(false);
      return;
    }

    try {
      setError("");
      const data = await apiRequest(API_URL);
      setMovies(data.movies);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMovies();
  }, [token]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.title.trim() || !form.durationMin) {
      setError("Movie title and duration are required.");
      return;
    }

    const movieData = {
      ...form,
      title: form.title.trim(),
      durationMin: Number(form.durationMin),
    };

    try {
      setSaving(true);

      if (editingId) {
        await apiRequest(`${API_URL}/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(movieData),
        });
        setMessage("Movie updated successfully.");
      } else {
        await apiRequest(API_URL, {
          method: "POST",
          body: JSON.stringify(movieData),
        });
        setMessage("Movie added successfully.");
      }

      resetForm();
      await loadMovies();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(movie) {
    setEditingId(movie.id);
    setForm({
      title: movie.title ?? "",
      description: movie.description ?? "",
      durationMin: String(movie.durationMin ?? ""),
      genre: movie.genre ?? "",
      language: movie.language ?? "",
      ageRating: movie.ageRating ?? "",
      posterUrl: movie.posterUrl ?? "",
      trailerUrl: movie.trailerUrl ?? "",
      status: movie.status,
    });

    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleArchive(movieId) {
    if (!window.confirm("Are you sure you want to archive this movie?")) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await apiRequest(`${API_URL}/${movieId}/archive`, {
        method: "PATCH",
      });
      setMessage("Movie archived successfully.");
      await loadMovies();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRestore(movie) {
    const status = window.prompt(
      "Restore as COMING_SOON or NOW_SHOWING?",
      "COMING_SOON",
    );

    if (status === null) return;

    const selectedStatus = status.trim().toUpperCase();

    if (!["COMING_SOON", "NOW_SHOWING"].includes(selectedStatus)) {
      setError("Enter COMING_SOON or NOW_SHOWING.");
      return;
    }

    try {
      setError("");
      setMessage("");
      await apiRequest(`${API_URL}/${movie.id}/restore`, {
        method: "PATCH",
        body: JSON.stringify({ status: selectedStatus }),
      });
      setMessage("Movie restored successfully.");
      await loadMovies();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(movie) {
    if (!window.confirm(`Delete "${movie.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await apiRequest(`${API_URL}/${movie.id}`, {
        method: "DELETE",
      });
      setMessage("Movie deleted successfully.");
      await loadMovies();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <p>Loading movies...</p>;
  }

  return (
    <main>
      <h1>Admin Movie Management</h1>
      <p>Add, edit, archive, restore, and manage cinema movies.</p>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      <section>
        <h2>{editingId ? "Edit Movie" : "Add New Movie"}</h2>

        <form onSubmit={handleSubmit}>
          <label htmlFor="title">Movie Title *</label>
          <input
            id="title"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
          />

          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleChange}
          />

          <label htmlFor="durationMin">Duration (minutes) *</label>
          <input
            id="durationMin"
            name="durationMin"
            type="number"
            min="1"
            value={form.durationMin}
            onChange={handleChange}
            required
          />

          <label htmlFor="genre">Genre</label>
          <input
            id="genre"
            name="genre"
            value={form.genre}
            onChange={handleChange}
          />

          <label htmlFor="language">Language</label>
          <input
            id="language"
            name="language"
            value={form.language}
            onChange={handleChange}
          />

          <label htmlFor="ageRating">Age Rating</label>
          <input
            id="ageRating"
            name="ageRating"
            value={form.ageRating}
            onChange={handleChange}
          />

          <label htmlFor="posterUrl">Poster URL</label>
          <input
            id="posterUrl"
            name="posterUrl"
            type="url"
            value={form.posterUrl}
            onChange={handleChange}
          />

          <label htmlFor="trailerUrl">Trailer URL</label>
          <input
            id="trailerUrl"
            name="trailerUrl"
            type="url"
            value={form.trailerUrl}
            onChange={handleChange}
          />

          <label htmlFor="status">Movie Status</label>
          <select
            id="status"
            name="status"
            value={form.status}
            onChange={handleChange}
          >
            <option value="COMING_SOON">Coming Soon</option>
            <option value="NOW_SHOWING">Now Showing</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save Changes" : "Add Movie"}
          </button>

          {editingId && (
            <button type="button" onClick={resetForm} disabled={saving}>
              Cancel Edit
            </button>
          )}
        </form>
      </section>

      <section>
        <h2>All Movies ({movies.length})</h2>

        {movies.length === 0 ? (
          <p>No movies found. Add your first movie above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Duration</th>
                <th>Genre</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {movies.map((movie) => (
                <tr key={movie.id}>
                  <td>{movie.title}</td>
                  <td>{movie.durationMin} min</td>
                  <td>{movie.genre || "—"}</td>
                  <td>{movie.status.replaceAll("_", " ")}</td>
                  <td>
                    <button type="button" onClick={() => handleEdit(movie)}>
                      Edit
                    </button>

                    {movie.status === "ARCHIVED" ? (
                      <button
                        type="button"
                        onClick={() => handleRestore(movie)}
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleArchive(movie.id)}
                      >
                        Archive
                      </button>
                    )}

                    <button type="button" onClick={() => handleDelete(movie)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
