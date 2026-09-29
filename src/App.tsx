import './styles.css';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { getMovieDetails, searchMovies } from './services/omdbApi';
import { Movie, MovieDetails } from './types/movie';

const FALLBACK_POSTER = 'https://placehold.co/300x450/e8ece3/2f4d31?text=No+poster';
const WATCHLIST_STORAGE_KEY = 'movie-app-watchlist';

type AiRecommendation = {
  title: string;
  year: number;
  reason: string;
  genres: string[];
};

function isAiRecommendation(value: unknown): value is AiRecommendation {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const recommendation = value as Record<string, unknown>;
  return (
    typeof recommendation.title === 'string' &&
    Number.isInteger(recommendation.year) &&
    typeof recommendation.reason === 'string' &&
    Array.isArray(recommendation.genres) &&
    recommendation.genres.every((genre) => typeof genre === 'string')
  );
}

function isAiRecommendationList(value: unknown): value is AiRecommendation[] {
  return Array.isArray(value) && value.length === 3 && value.every(isAiRecommendation);
}

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
  const location = useLocation();
  const navigate = useNavigate();
  const routeMovieId = location.pathname.startsWith('/movie/')
    ? decodeURIComponent(location.pathname.slice('/movie/'.length))
    : '';

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
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiRecommendations, setAiRecommendations] = useState<AiRecommendation[]>([]);
  const [aiError, setAiError] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [healthCheckedAt, setHealthCheckedAt] = useState('');
  const [healthResultCount, setHealthResultCount] = useState(0);
  const [healthSampleTitle, setHealthSampleTitle] = useState('');
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

  useEffect(() => {
    if (!routeMovieId) {
      return;
    }

    if (routeMovieId !== selectedMovieId) {
      void handleMovieSelect(routeMovieId);
    }
  }, [routeMovieId, selectedMovieId]);

  useEffect(() => {
    if (location.pathname !== '/health') {
      return;
    }

    let isCancelled = false;

    async function checkHealth() {
      setHealthStatus('loading');
      setHealthCheckedAt('');
      setHealthResultCount(0);
      setHealthSampleTitle('');

      try {
        const results = await searchMovies('The Matrix');

        if (isCancelled) {
          return;
        }

        const sampleTitle = results[0]?.Title ?? 'No sample title available';
        setHealthStatus('success');
        setHealthCheckedAt(new Date().toLocaleString());
        setHealthResultCount(results.length);
        setHealthSampleTitle(sampleTitle);
      } catch {
        if (isCancelled) {
          return;
        }

        setHealthStatus('error');
        setHealthCheckedAt(new Date().toLocaleString());
        setHealthResultCount(0);
        setHealthSampleTitle('');
      }
    }

    void checkHealth();

    return () => {
      isCancelled = true;
    };
  }, [location.pathname]);

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

  async function handleAiRecommendation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = aiPrompt.trim();

    if (!prompt) {
      return;
    }

    setIsAiLoading(true);
    setAiError('');
    setAiRecommendations([]);

    try {
      const response = await fetch('/api/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const result: { recommendations?: unknown } | null = await response.json();
      const recommendations = result?.recommendations;

      if (!response.ok || !isAiRecommendationList(recommendations)) {
        throw new Error('Recommendation request failed');
      }

      setAiRecommendations(recommendations);
    } catch {
      setAiError("Sorry, we couldn't get recommendations right now. Please try again.");
    } finally {
      setIsAiLoading(false);
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

  function renderMovieCard(movie: Movie, isFirstVisible = false, onSelect?: (id: string) => void) {
    const selectMovie = onSelect ?? ((imdbID: string) => {
      void handleMovieSelect(imdbID);
    });

    return (
      <button
        className="movie-card"
        key={movie.imdbID}
        type="button"
        onClick={() => selectMovie(movie.imdbID)}
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

  function renderHomeScreen() {
    return (
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

        <section
          className="ai-recommendation-section"
          aria-labelledby="ai-recommendation-title"
          aria-busy={isAiLoading}
        >
          <div>
            <p className="eyebrow">A little inspiration</p>
            <h2 id="ai-recommendation-title">AI Movie Recommendations</h2>
          </div>
          <form className="ai-recommendation-form" onSubmit={handleAiRecommendation}>
            <label htmlFor="ai-movie-prompt">What kind of movie are you in the mood for?</label>
            <textarea
              id="ai-movie-prompt"
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="I want something like Interstellar but more adventurous..."
              rows={3}
              required
            />
            <button type="submit" disabled={isAiLoading || !aiPrompt.trim()}>
              {isAiLoading ? 'Getting recommendations...' : 'Get AI Recommendations'}
            </button>
          </form>
          {isAiLoading && (
            <p className="ai-status-message" role="status" aria-live="polite">
              Finding a movie for you...
            </p>
          )}
          {aiError && <p className="ai-status-message error-message" role="alert">{aiError}</p>}
          {aiRecommendations.length > 0 && (
            <div className="ai-recommendation-result" aria-live="polite">
              <h3>Recommended for you</h3>
              <ol className="ai-recommendation-grid" aria-label="AI movie recommendations">
                {aiRecommendations.map((recommendation, index) => (
                  <li key={`${recommendation.title}-${recommendation.year}-${index}`}>
                    <article className="ai-recommendation-card">
                      <div className="ai-recommendation-card-heading">
                        <h4>{recommendation.title}</h4>
                        <span>{recommendation.year}</span>
                      </div>
                      <ul className="ai-recommendation-genres" aria-label="Genres">
                        {recommendation.genres.map((genre) => (
                          <li key={genre}>{genre}</li>
                        ))}
                      </ul>
                      <div>
                        <h5>Why it matches</h5>
                        <p>{recommendation.reason}</p>
                      </div>
                    </article>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

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
              {filteredMovies.map((movie, index) =>
                renderMovieCard(movie, index === 0, (imdbID) => {
                  navigate(`/movie/${encodeURIComponent(imdbID)}`);
                  void handleMovieSelect(imdbID);
                }),
              )}
            </div>
          )}
        </div>

        <section className="watchlist-section" aria-labelledby="watchlist-title">
          <div className="section-heading">
            <h2 id="watchlist-title">Watchlist</h2>
            <span>{watchlist.length} saved</span>
          </div>
          {watchlist.length === 0 ? (
            <p className="status-message" role="status">
              Your watchlist is empty. Add a movie to save it here.
            </p>
          ) : (
            <div className="movie-grid">
              {watchlist.map((movie, index) =>
                renderMovieCard(movie, index === 0, (imdbID) => {
                  navigate(`/movie/${encodeURIComponent(imdbID)}`);
                  void handleMovieSelect(imdbID);
                }),
              )}
            </div>
          )}
          {storageError && (
            <p className="status-message" role="status">
              Your watchlist is available for this session but could not be saved.
            </p>
          )}
        </section>
      </section>
    );
  }

  function renderDetailsScreen() {
    return (
      <section className="app-intro movie-details" aria-busy={isDetailsLoading}>
        <button
          className="back-button"
          type="button"
          onClick={() => {
            handleBackToResults();
            navigate('/');
          }}
        >
          Back to search results
        </button>
        {isDetailsLoading && <p className="status-message" role="status">Loading movie details...</p>}
        {!isDetailsLoading && detailsError && (
          <p className="status-message error-message" role="alert">{detailsError}</p>
        )}
        {!isDetailsLoading && selectedMovie && (
          <article className="details-content">
            <img src={getPoster(selectedMovie.Poster)} alt={`${selectedMovie.Title} poster`} />
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
                {recommendations.map((movie, index) =>
                  renderMovieCard(movie, index === 0, (imdbID) => {
                    navigate(`/movie/${encodeURIComponent(imdbID)}`);
                    void handleMovieSelect(imdbID);
                  }),
                )}
              </div>
            ) : (
              <p className="status-message" role="status">No similar movies available yet.</p>
            )}
          </section>
        )}
      </section>
    );
  }

  function renderWatchlistScreen() {
    return (
      <section className="app-intro" aria-labelledby="watchlist-page-title">
        <p className="eyebrow">Saved picks</p>
        <h1 id="watchlist-page-title">Your Watchlist</h1>
        <div className="watchlist-section" aria-labelledby="watchlist-page-title">
          {watchlist.length === 0 ? (
            <p className="status-message" role="status">
              Your watchlist is empty. Add a movie to save it here.
            </p>
          ) : (
            <div className="movie-grid">
              {watchlist.map((movie, index) =>
                renderMovieCard(movie, index === 0, (imdbID) => {
                  navigate(`/movie/${encodeURIComponent(imdbID)}`);
                  void handleMovieSelect(imdbID);
                }),
              )}
            </div>
          )}
          {storageError && (
            <p className="status-message" role="status">
              Your watchlist is available for this session but could not be saved.
            </p>
          )}
        </div>
      </section>
    );
  }

  function renderHealthScreen() {
    return (
      <section className="app-intro" aria-labelledby="health-title">
        <p className="eyebrow">System status</p>
        <h1 id="health-title">App health check</h1>

        {healthStatus === 'loading' && (
          <p className="status-message" role="status" aria-live="polite">
            Checking the movie service…
          </p>
        )}

        {healthStatus === 'success' && (
          <div className="health-panel" role="status" aria-live="polite">
            <p className="health-status success">Status: Healthy</p>
            <dl className="health-metrics">
              <div>
                <dt>Checked</dt>
                <dd>{healthCheckedAt}</dd>
              </div>
              <div>
                <dt>Result count</dt>
                <dd>{healthResultCount}</dd>
              </div>
              <div>
                <dt>Sample title</dt>
                <dd>{healthSampleTitle}</dd>
              </div>
            </dl>
          </div>
        )}

        {healthStatus === 'error' && (
          <p className="status-message error-message" role="alert" aria-live="assertive">
            The movie service is temporarily unavailable. Please try again later.
          </p>
        )}
      </section>
    );
  }

  return (
    <main className="page-shell">
      <header className="top-nav" aria-label="Main navigation">
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/">
          Home
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/watchlist">
          Watchlist
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/health">
          Health
        </NavLink>
      </header>

      <Routes>
        <Route path="/" element={renderHomeScreen()} />
        <Route path="/movie/:id" element={renderDetailsScreen()} />
        <Route path="/watchlist" element={renderWatchlistScreen()} />
        <Route path="/health" element={renderHealthScreen()} />
      </Routes>
    </main>
  );
}