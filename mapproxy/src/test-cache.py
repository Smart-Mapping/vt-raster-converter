import sys
import sqlite3

def test_cache(args):
    """
    Count tiles in mbtile files
    """

    if len(args) > 1:
        dir = args[1]
        for i in range(14):
            mbtilePath = dir + '/' + str(i) + '.mbtile'

            try:
                conn = sqlite3.connect(mbtilePath)
                cur = conn.cursor()
                cur.execute('''SELECT count(*) from tiles''')
                result = cur.fetchone()[0]
                print(str(i) + ":  " + str(result))
            except Exception as e:
                print(e)
            finally:
                if conn is not None:
                    conn.close() 

            

if __name__ == "__main__":
    test_cache(sys.argv)