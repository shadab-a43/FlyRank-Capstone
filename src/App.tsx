import './styles.css';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { getMovieDetails, searchMovies } from './services/omdbApi';
import { Movie, MovieDetails } from './types/movie';

const FALLBACK_POSTER = 'https://placehold.co/300x450/e8ece3/2f4d31?text=No+poster';
const WATCHLIST_STORAGE_KEY = 'movie-app-watchlist';

function readWatchlist(): Movie[] {
  try {
    const savedMovies = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    const parsedMovies: unknown = savedMovies ? JSON.parse(savedMovies) : [];

    if (!Array.isArray(parsedMovies)) {
      return [];
    }

    return parsedMovies.filter(
      (movie): movie is Movie =>
        typeof movie === 'object' &&
        movie !== null &&
        typeof movie.imdbID === 'string' &&
        typeof movie.Title === 'string' &&
        typeof movie.Year === 'string' &&
        typeof movie.Type === 'string' &&
        typeof movie.Poster === 'string',
    );
  } catch {
    return [];
  }
}

function hasMatchingGenre(movieGenre: string | undefined, selectedGenre: string) {
  if (!movieGenre || !selectedGenre) {
    return false;
  }

  const selectedGenres = selectedGenre.split(',').map((genre) => genre.trim().toLowerCase());
  return movieGenre
    .split(',')
    .map((genre) => genre.trim().toLowerCase())
    .some((genre) => selectedGenres.includes(genre));
}

export default function App() {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [watchlist, setWatchlist] = useState<Movie[]>(readWatchlist);
  const [selectedMovieId, setSelectedMovieId] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<MovieDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const detailsRequestController = useRef<AbortController | null>(null);
  const detailsRequestId = useRef(0);

  const availableGenres = Array.from(
    new Set(
      movies.flatMap((movie) =>
        movie.Genre
          ? movie.Genre.split(',').map((genre) => genre.trim()).filter(Boolean)
          : [],
      ),
    ),
  ).sort();
  const filteredMovies =
    selectedGenre === 'all'
      ? movies
      : movies.filter((movie) =>
          movie.Genre?.split(',').some((genre) => genre.trim() === selectedGenre),
        );
  const recommendations = selectedMovie
    ? movies
        .filter(
          (movie) =>
            movie.imdbID !== selectedMovie.imdbID &&
            hasMatchingGenre(movie.Genre, selectedMovie.Genre),
        )
        .slice(0, 4)
    : [];

  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [watchlist]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setMovies([]);
      setSelectedGenre('all');
      setError('Enter a movie title to search.');
      setHasSearched(true);
      return;
    }

    setIsLoading(true);
    setError('');
    setSelectedGenre('all');
    setHasSearched(true);

    try {
      setMovies(await searchMovies(trimmedQuery));
    } catch (searchError) {
      setMovies([]);
      setError(searchError instanceof Error ? searchError.message : 'Unable to search for movies.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMovieSelect(imdbID: string) {
    const requestId = detailsRequestId.current + 1;
    detailsRequestId.current = requestId;
    detailsRequestController.current?.abort();
    const requestController = new AbortController();
    detailsRequestController.current = requestController;
    setSelectedMovieId(imdbID);
    setSelectedMovie(null);
    setDetailsError('');
    setIsDetailsLoading(true);

    try {
      const details = await getMovieDetails(imdbID, requestController.signal);
      if (requestId !== detailsRequestId.current) {
        return;
      }

      setSelectedMovie(details);
      setMovies((currentMovies) =>
        currentMovies.map((movie) =>
          movie.imdbID === details.imdbID ? { ...movie, Genre: details.Genre } : movie,
        ),
      );
    } catch (detailError) {
      if (
        requestId !== detailsRequestId.current ||
        (detailError instanceof Error && detailError.name === 'AbortError')
      ) {
        return;
      }

      setDetailsError(
        detailError instanceof Error ? detailError.message : 'Unable to load movie details.',
      );
    } finally {
      if (requestId === detailsRequestId.current) {
        setIsDetailsLoading(false);
      }
    }
  }

  function handleBackToResults() {
    detailsRequestId.current += 1;
    detailsRequestController.current?.abort();
    detailsRequestController.current = null;
    setSelectedMovieId('');
    setSelectedMovie(null);
    setDetailsError('');
    setIsDetailsLoading(false);
  }

  function handleWatchlistToggle() {
    if (!selectedMovie) {
      return;
    }

    setWatchlist((currentWatchlist) => {
      const isSaved = currentWatchlist.some((movie) => movie.imdbID === selectedMovie.imdbID);

      if (isSaved) {
        return currentWatchlist.filter((movie) => movie.imdbID !== selectedMovie.imdbID);
      }

      const { imdbID, Title, Year, Type, Poster, Genre } = selectedMovie;
      return [...currentWatchlist, { imdbID, Title, Year, Type, Poster, Genre }];
    });
  }

  function getPoster(poster: string) {
    return poster && poster !== 'N/A' ? poster : FALLBACK_POSTER;
  }

  function getDetailValue(value: string) {
    return value && value !== 'N/A' ? value : 'Not available';
  }

  function renderMovieCard(movie: Movie, isFirstVisible = false) {
    return (
      <button
        className="movie-card"
        key={movie.imdbID}
        type="button"
        onClick={() => handleMovieSelect(movie.imdbID)}
        aria-label={`View details for ${movie.Title}`}
      >
        <img
          src={getPoster(movie.Poster)}
          alt={`${movie.Title} poster`}
          loading={isFirstVisible ? 'eager' : 'lazy'}
        />
        <div className="movie-card-content">
          <h3>{movie.Title}</h3>
          <p>{movie.Year}</p>
          <span>{movie.Type}</span>
        </div>
      </button>
    );
  }

  return (
    <main className="page-shell">
      <section className="app-intro" aria-labelledby="app-title">
        <p className="eyebrow">Movie discovery</p>
        <h1 id="app-title">Find your next favorite film.</h1>
        <p className="intro">Search the OMDb catalog for movies, series, and episodes.</p>

        <form className="search-form" onSubmit={handleSearch}>
          <label htmlFor="movie-search">Movie title</label>
          <div className="search-controls">
            <input
              id="movie-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try The Matrix"
              autoComplete="off"
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        <section className="watchlist-section" aria-labelledby="watchlist-title">
          <div className="section-heading">
            <h2 id="watchlist-title">Watchlist</h2>
            <span>{watchlist.length} saved</span>
          </div>
          {watchlist.length === 0 ? (
            <p className="status-message" role="status">Your watchlist is empty. Add a movie to save it here.</p>
          ) : (
            <div className="movie-grid">
              {watchlist.map((movie, index) => renderMovieCard(movie, index === 0))}
            </div>
          )}
          {storageError && (
            <p className="status-message" role="status">
              Your watchlist is available for this session but could not be saved.
            </p>
          )}
        </section>

        {selectedMovieId ? (
          <section className="movie-details" aria-busy={isDetailsLoading}>
            <button className="back-button" type="button" onClick={handleBackToResults}>
              Back to search results
            </button>
            {isDetailsLoading && <p className="status-message" role="status">Loading movie details...</p>}
            {!isDetailsLoading && detailsError && (
              <p className="status-message error-message" role="alert">{detailsError}</p>
            )}
            {!isDetailsLoading && selectedMovie && (
              <article className="details-content">
                <img
                  src={getPoster(selectedMovie.Poster)}
                  alt={`${selectedMovie.Title} poster`}
                />
                <div>
                  <p className="eyebrow">{getDetailValue(selectedMovie.Type)}</p>
                  <h2>{selectedMovie.Title}</h2>
                  <p className="details-meta">
                    {getDetailValue(selectedMovie.Year)} - IMDb {getDetailValue(selectedMovie.imdbRating)}
                  </p>
                  <button className="watchlist-button" type="button" onClick={handleWatchlistToggle}>
                    {watchlist.some((movie) => movie.imdbID === selectedMovie.imdbID)
                      ? 'Remove from Watchlist'
                      : 'Add to Watchlist'}
                  </button>
                  <dl className="details-facts">
                    <div>
                      <dt>Genre</dt>
                      <dd>{getDetailValue(selectedMovie.Genre)}</dd>
                    </div>
                    <div>
                      <dt>Runtime</dt>
                      <dd>{getDetailValue(selectedMovie.Runtime)}</dd>
                    </div>
                    <div>
                      <dt>Director</dt>
                      <dd>{getDetailValue(selectedMovie.Director)}</dd>
                    </div>
                    <div>
                      <dt>Actors</dt>
                      <dd>{getDetailValue(selectedMovie.Actors)}</dd>
                    </div>
                  </dl>
                  <h3>Plot</h3>
                  <p className="details-plot">{getDetailValue(selectedMovie.Plot)}</p>
                </div>
              </article>
            )}
            {!isDetailsLoading && selectedMovie && (
              <section className="recommendations" aria-labelledby="recommendations-title">
                <h2 id="recommendations-title">You May Also Like</h2>
                {recommendations.length > 0 ? (
                  <div className="movie-grid">
                    {recommendations.map((movie, index) => renderMovieCard(movie, index === 0))}
                  </div>
                ) : (
                  <p className="status-message" role="status">No similar movies available yet.</p>
                )}
              </section>
            )}
          </section>
        ) : (
        <div className="results-area" aria-busy={isLoading}>
          <div className="filter-controls">
            <label htmlFor="genre-filter">Genre</label>
            <select
              id="genre-filter"
              value={selectedGenre}
              onChange={(event) => setSelectedGenre(event.target.value)}
              disabled={movies.length === 0}
            >
              <option value="all">All Genres</option>
              {availableGenres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>
          {isLoading && <p className="status-message" role="status">Searching for movies...</p>}
          {!isLoading && error && <p className="status-message error-message" role="alert">{error}</p>}
          {!isLoading && !error && hasSearched && movies.length === 0 && (
            <p className="status-message" role="status">No movies found.</p>
          )}
          {!isLoading && !error && movies.length > 0 && filteredMovies.length === 0 && (
            <p className="status-message" role="status">No movies match the selected genre.</p>
          )}
          {!isLoading && !error && filteredMovies.length > 0 && (
            <div className="movie-grid">
              {filteredMovies.map((movie, index) => renderMovieCard(movie, index === 0))}
            </div>
          )}
        </div>
        )}
      </section>
    </main>
  );
}