serve:
	cd afqbrowser/site/client/ && python -m http.server

test:
	py.test --pyargs afqbrowser --cov-report term-missing --cov=afqbrowser && flake8 --ignore N802,N806 `find . -name \*.py | grep -v setup.py | grep -v version.py | grep -v __init__.py | grep -v /doc/`
