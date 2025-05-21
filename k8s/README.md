### Deployment of the components

Create PVC for input data and MapProxy cache:
```
kubectl apply -n pxx -f k8s/storage/storage-class.yaml
kubectl apply -n pxx -f k8s/storage/data-pvc.yaml
```

Chart for MapProxy (Seeding):
```
helm upgrade --install -n pxx mapproxy k8s/mapproxy-chart/
```

Chart for VT Raster Converter:
```
helm upgrade --install -n pxx vt-raster-converter k8s/vt-raster-converter-chart/
```