import codecs
import pandas as pd

def get_unique_shows(shows_path: str) -> pd.DataFrame:
    df = pd.read_csv(shows_path, sep=";")
    df = df[["sid", "title", "poster"]]
    return df.drop_duplicates(subset=["sid"])

def create_shows_sql(df: pd.DataFrame) -> None:
    f = codecs.open("shows.sql", "w+", "utf-8")
    sql = 'INSERT INTO "Show" ("id", "title", "poster") VALUES'

    for data in df.values:
        sql += f"\n({data[0]}, '{data[1]}', '{data[2]}'),"

    f.write(sql[:-1] + ";")
    f.close()

def link_users_to_shows(shows_path: str) -> pd.DataFrame:
    df = pd.read_csv(shows_path, sep=";")
    return df[["added_at", "user_id", "sid"]]

def create_users_shows(df: pd.DataFrame) -> None:
    f = codecs.open("users_shows.sql", "w+", "utf-8")
    sql = 'INSERT INTO "UserShow" ("continue", "addedAt", "userId", "showId") VALUES'

    for data in df.values:
        sql += f"\n(true, '{data[0]}', '{data[1]}', {data[2]}),"

    f.write(sql[:-1] + ";")
    f.close()

def get_unique_seasons(seasons_path: str, shows_path: str) -> pd.DataFrame:
    df_shows = pd.read_csv(shows_path, sep=";")
    df_seasons = pd.read_csv(seasons_path, sep=";")

    df = pd.merge(df_shows, df_seasons, on="series_id")
    df = df.drop_duplicates(subset=["sid", "number"])
    return df[["sid", "episode_length", "number", "image", "episodes"]]

def create_seasons(df: pd.DataFrame) -> None:
    f = codecs.open("seasons.sql", "w+", "utf-8")
    sql = 'INSERT INTO "Season" ("showId", "epDuration", "number", "image", "episode") VALUES'

    for data in df.values:
        sql += f"\n({data[0]}, {data[1]}, {data[2]}, '{data[3]}', {data[4]}),"

    f.write(sql[:-1] + ";")
    f.close()

def link_users_to_seasons(shows_path: str, seasons_path: str) -> pd.DataFrame:
    df_shows = pd.read_csv(shows_path, sep=";")
    df_seasons = pd.read_csv(seasons_path, sep=";")

    df = pd.merge(df_shows, df_seasons, on="series_id")
    return df[["viewed_at", "user_id", "sid", "number"]]

def create_users_seasons(df: pd.DataFrame) -> None:
    f = codecs.open("users_seasons.sql", "w+", "utf-8")
    sql = 'INSERT INTO "UserSeason" ("addedAt", "userId", "showId", "number") VALUES'

    for data in df.values:
        sql += f"\n('{data[0]}', '{data[1]}', {data[2]}, {data[3]}),"

    f.write(sql[:-1] + ";")
    f.close()

def main():
    df = get_unique_shows("./shows.txt")
    create_shows_sql(df)

    df = link_users_to_shows("./shows.txt")
    create_users_shows(df)

    df = get_unique_seasons("./seasons.txt", "./shows.txt")
    create_seasons(df)

    df = link_users_to_seasons("./shows.txt", "./seasons.txt")
    create_users_seasons(df)

main()