import os.path as op
import afqbrowser as afqb
import tempfile
import json
import pandas as pd
import numpy.testing as npt


def test_assemble():
    data_path = op.join(afqb.__path__[0], 'site')
    tdir = tempfile.mkdtemp()
    afqb.assemble(op.join(data_path, 'client', 'data', 'afq.mat'),
                  target=tdir, title='', subtitle='', link='', sublink='')

    # Check for regression against know results:
    out_data = op.join(tdir, 'AFQ-browser', 'client', 'data')
    params_file = op.join(out_data, 'params.json')
    params = json.loads(open(params_file).read())
    npt.assert_equal(params['analysis_params']['track']['stepSizeMm'], 1)
    nodes_file = op.join(out_data, 'nodes.csv')
    nodes = pd.read_csv(nodes_file)
    npt.assert_almost_equal(nodes['fa'][0], 0.4529922120694605)


def test_tracula():
    data_path = op.join(afqb.__path__[0], 'site', 'client',
                        'data', 'tracula_data')
    stats_dir = op.join(data_path, 'stats')
    tdir = tempfile.mkdtemp()
    nodes_fname, meta_fname, streamlines_fname, params_fname =\
        afqb.tracula2nodes(stats_dir, out_path=tdir)

    # Test for regressions:
    nodes = pd.read_csv(nodes_fname)
    npt.assert_equal(nodes.shape, (2643, 11))
