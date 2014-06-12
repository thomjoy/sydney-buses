import psycopg2

tables = ['stops']

conn = psycopg2.connect("dbname=nsw_traffic user=thomjoy")
cur = conn.cursor()
cur.execute("SELECT * FROM stops")
rows = cur.fetchall()

for row in rows:
    stop_id = row[0]
    lat = row[3]
    lon = row[4]
    cur.execute("UPDATE stops SET geom = ST_SetSRID(ST_MakePoint(%s, %s), 26913) WHERE stop_id = %s", (lon, lat, stop_id))
    conn.commit()
