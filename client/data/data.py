import os.path as op
import scipy.io as sio
import pandas as pd
import numpy as np

def mat2tables(mat_file_name, subject_ids=None, stats=None,
               out_path=None):
    """
    Create a nodes table and a subjects table from an AFQ `.mat` file

    Parameters
    ----------
    mat_file_name : str
        Full path to an AFQ-processed mat-file

    subject_ids : list, optional
        Identifiers for the subjects.
        Default: ['subject_001', 'subject_002,' ...]

    stats : list, optional
        List of keys for statistics to pull from the AFQ data.
        Default: pull out all of the statistics that are in the mat file.

    out_file : str
        Full path to the CSV file to be saved as output

    Returns
    -------
    tuple: paths to the files that get generated: (nodes, subjects)
    """
    afq = sio.loadmat(mat_file_name, squeeze_me=True)['afq']
    vals = afq['vals'].item()
    tract_ids = afq['fgnames'].item()

    n_tracts = len(tract_ids)
    if stats is None:
        stats = list(vals.dtype.fields.keys())
    columns = ['subjectID', 'tractID', 'nodeID']
    columns = columns + stats
    df = pd.DataFrame(columns=columns)
    n_subjects, nodes_per_tract = vals[stats[0]].item()[0].shape

    # Check if subject ids is defined in the afq structure
    if subject_ids is None:
        if 'sub_ids' in afq.dtype.names and len(afq['sub_ids'].item()):
            subject_ids = afq['sub_ids'].item()
        else:
            # XXX Make the number of zeros flexible and depend on n_subjects:
            subject_ids = ['subject_%03d' % i for i in range(n_subjects)]

    # Loop over subjects
    for subject in range(len(subject_ids)):
        # Loop over tracts
        for tract in range(n_tracts):
            # Making a subject and tract specific dataframe
            subj_df = pd.DataFrame(
                    columns=['subjectID', 'tractID', 'nodeID'],
                    data=np.array([[subject_ids[subject]] * nodes_per_tract,
                                   [tract_ids[tract]] * nodes_per_tract,
                                   np.arange(nodes_per_tract)]).T)
            # We're looping over the desired stats (eg fa, md) and adding them
            # to the subjects dataframe
            for stat in stats:
                scalar = vals[stat].item()[tract][subject, :]
                subj_df[stat] = scalar
            # The subject's dataframe for this tract is now appended to the
            # whole dataframe here:
            df = df.append(subj_df)

    # Set output path from the input kwarg:
    if out_path is None:
        out_path = '.'

    nodes_fname = op.join(out_path, 'nodes.csv')
    # Write to file
    df.to_csv(nodes_fname, index=False)

    # Create metadata
    metadata = afq['metadata'].item()
    meta_df = pd.DataFrame(data=np.hstack([subject_ids.reshape((6, 1)),
                                           np.array(metadata.item()).T]),
                           columns=["subjectID"] + list(metadata.dtype.names))

    meta_fname = op.join(out_path, 'subjects.json')
    meta_df.to_json(meta_fname, orient='records')

    return nodes_fname, meta_fname
