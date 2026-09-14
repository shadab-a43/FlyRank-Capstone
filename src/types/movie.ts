export type MovieType = 'movie' | 'series' | 'episode';

export interface Movie {
  imdbID: string;
  Title: string;
  Year: string;
  Type: MovieType;
  Poster: string;
  Genre?: string;
}

export interface MovieDetails extends Movie {
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Actors: string;
  Plot: string;
  imdbRating: string;
  imdbVotes: string;
}

export interface OmdbSearchResponse {
  Search?: Movie[];
  totalResults?: string;
  Response: 'True' | 'False';
  Error?: string;
}

export interface OmdbDetailsResponse extends MovieDetails {
  Response: 'True' | 'False';
  Error?: string;
}