import { Movie, MovieDetails, OmdbDetailsResponse, OmdbSearchResponse } from '../types/movie';

const OMDB_API_URL = 'https://www.omdbapi.com/';
const movieDetailsCache = new Map<string, MovieDetails>();

function getApiKey(): string {
  const apiKey = import.meta.env.VITE_OMDB_API_KEY;

  if (!apiKey || apiKey === 'your_omdb_api_key_here') {
    throw new Error('The OMDb API key is not configured.');
  }

  return apiKey;
}

async function request<T>(params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const searchParams = new URLSearchParams({
    apikey: getApiKey(),
    r: 'json',
    ...params,
  });
  const response = await fetch(`${OMDB_API_URL}?${searchParams}`, { signal });

  if (!response.ok) {
    throw new Error(`OMDb request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as T & { Response: 'True' | 'False'; Error?: string };

  if (data.Response === 'False') {
    throw new Error(data.Error ?? 'The OMDb request failed.');
  }

  return data;
}

export async function searchMovies(query: string, page = 1): Promise<Movie[]> {
  const data = await request<OmdbSearchResponse>({ s: query, page: String(page) });
  return data.Search ?? [];
}

export async function getMovieDetails(imdbID: string, signal?: AbortSignal): Promise<MovieDetails> {
  const cachedDetails = movieDetailsCache.get(imdbID);

  if (cachedDetails) {
    return cachedDetails;
  }

  const details = await request<OmdbDetailsResponse>({ i: imdbID, plot: 'full' }, signal);
  movieDetailsCache.set(imdbID, details);
  return details;
}