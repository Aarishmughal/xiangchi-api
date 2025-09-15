exports.getAll = (Model) => async (req, res) => {
  const docs = await Model.find();
  res.status(200).json({
    status: 'success',
    data: docs,
  });
};
exports.getOne = (Model) => async (req, res) => {
  const doc = await Model.findById(req.params.id);
  res.status(200).json({
    status: 'success',
    data: doc,
  });
};
exports.createOne = (Model) => async (req, res) => {
  const doc = await Model.create(req.body);
  res.status(201).json({
    status: 'success',
    data: doc,
  });
};
exports.updateOne = (Model) => async (req, res) => {
  const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  res.status(200).json({
    status: 'success',
    data: doc,
  });
};
exports.deleteOne = (Model) => async (req, res) => {
  await Model.findByIdAndDelete(req.params.id);
  res.status(204).json({
    status: 'success',
    data: null,
  });
};
