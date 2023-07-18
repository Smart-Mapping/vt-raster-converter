# WSGI module for use with Apache mod_wsgi or gunicorn

from logging.config import fileConfig
import os.path
fileConfig(r'/mapproxy/config/log.ini', {'here': os.path.dirname(__file__)})

from mapproxy.wsgiapp import make_wsgi_app
application = make_wsgi_app(r'/mapproxy/config/mapproxy.yaml')