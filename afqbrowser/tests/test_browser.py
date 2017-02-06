import os.path
import afqbrowser as afqb


def test_assemble():
    data_path = op.join(afqb.__path__[0], 'site')
    afqb.assemble(op.join(data_path, 'client', 'data', 'afq.mat'))
